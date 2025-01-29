import os
import sys
import json
import tempfile
import xmltodict
import subprocess
from lxml import etree
from random import randint
from obspy.core import AttribDict
from obspy.geodetics import FlinnEngdahl

PYTHON3 = sys.version[0] == '3'

if PYTHON3:
    from urllib.request import Request, urlopen
else:
    from urllib2 import Request, urlopen


def load_config(filename):
    with open(filename, 'r') as f:
        return AttribDict(json.load(f))


FE = FlinnEngdahl()
DEBUG = False
CONFIG = load_config('/home/cheze/repositories/webpicker/config.json')
SEISCOMP_PROGRAM = os.path.join(CONFIG.seiscomp.root, 'bin', 'seiscomp')

def fix_ids(o, remove=False):
    if isinstance(o, list):
        for item in o:
            fix_ids(item, remove)
    elif isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, str) and k.endswith('ID') and k != 'agencyID':
                if remove and v.startswith('smi:'):
                    o[k] = '/'.join(v.split('/')[1:])
                else:
                    if not v.startswith('smi:'):
                        o[k] = f'smi:oca/{v}'
            else:
                fix_ids(v, remove)

def jquake_to_quakeml(jquake, add_prefix_id=True):
    if add_prefix_id:
        fix_ids(jquake)
    qml = {
        "q:quakeml": {
            "@xmlns": "http://quakeml.org/xmlns/bed/1.2",
            "@xmlns:q": "http://quakeml.org/xmlns/quakeml/1.2",
            "eventParameters": {
                "@publicID": "smi:oca/NA",
                "event": jquake
            }
        }
    }
    return xmltodict.unparse(qml).replace(' encoding="utf-8"', '')

def quakeml_to_jquake(qml, remove_prefix_id=True):
    j = xmltodict.parse(qml)
    jquake = [j['q:quakeml']['eventParameters']['event']]
    if remove_prefix_id:
        fix_ids(jquake, remove=True)
    return jquake

def sc3ml_to_quakeml(sc3ml_str, add_prefix_id=True):
    dom = etree.fromstring(sc3ml_str)
    newdom = apply_xslt(dom, get_sc3ml_to_qml_xslt())
    qml = etree.tostring(newdom)
    jquake = xmltodict.parse(qml)
    if add_prefix_id:
        fix_ids(jquake)
    return xmltodict.unparse(jquake)

def dump_seiscomp3_config():
    fd, conf_filename = tempfile.mkstemp()
    scxmldump = subprocess.Popen([SEISCOMP_PROGRAM, 'exec', 'scxmldump', '-f', '-C', '-d', CONFIG.seiscomp.database_uri], stdout=subprocess.PIPE)
    config, _ = scxmldump.communicate()
    f = os.fdopen(fd, 'w')
    if PYTHON3:
        f.write(config.decode('utf-8'))
    else:
        f.write(config)
    f.close()
    os.rename(conf_filename, CONFIG.seiscomp.config_filename)

def get_sc3ml_to_qml_xslt():
    v = CONFIG.seiscomp.schema_version
    return f'{ CONFIG.seiscomp.root }/share/xml/{v}/sc3ml_{v}__quakeml_1.2.xsl'

def get_qml_to_sc3ml_xslt():
    v = CONFIG.seiscomp.schema_version
    return f'{ CONFIG.seiscomp.root }/share/xml/{v}/quakeml_1.2__sc3ml_{v}.xsl'

def gen_id():
    hexa = ['%x'% x for x in range(0, 16)]
    return ''.join([hexa[randint(0, 15)] for x in range(0, 16)])

def apply_xslt(document, xslt_path):
    xslt = etree.parse(xslt_path)
    transform = etree.XSLT(xslt)
    return transform(document)

def update_sc3ml_origin_reference(root):
    namespace = list(root.nsmap.values())[0] if PYTHON3 else root.nsmap.values()[0]
    origin = root[0].find('{%s}origin' % namespace)
    origin_id = origin.attrib['publicID']
    e = root[0].find('{%s}event' % namespace)
    po = e.find('{%s}preferredOriginID' % namespace)
    oref = e.find('{%s}originReference' % namespace)
    po.text = origin_id
    oref.text = origin_id

def fix_scmag_magnitude_public_id(root):
    namespace = list(root.nsmap.values())[0] if PYTHON3 else root.nsmap.values()[0]
    origin = root[0].find('{%s}origin' % namespace)
    mags = origin.findall('{%s}magnitude' % namespace)
    for mag in mags:
        mag.attrib['publicID'] = mag.attrib['publicID'].replace('/', '.')

def write_sc3ml(jquake, filename):
    qml = jquake_to_quakeml(jquake, add_prefix_id=False)
    dom = etree.fromstring(qml)
    sc3ml = apply_xslt(etree.ElementTree(dom), get_qml_to_sc3ml_xslt())
    with open(filename, 'w') as f:
        f.write(etree.tostring(sc3ml).decode('utf-8'))

def get_inventory(jquake):
    _, inv_filename = tempfile.mkstemp(suffix=".xml")
    data = [
        'level=response',
        'format=xml'
    ]
    po = jquake[0]['origin'][0] if isinstance(jquake[0]['origin'], list) else jquake[0]['origin']
    t = po['time']['value'][0:19]
    for pick in jquake[0]['pick']:
        wfid = pick['waveformID']
        loc = wfid['@locationCode'] if '@locationCode' in wfid else '--'
        data.append(f'{wfid["@networkCode"]} {wfid["@stationCode"]} {loc} {wfid["@channelCode"]} {t} {t}')
    req_data = '\r\n'.join(data).encode('utf-8')
    r = Request('http://%s/fdsnws/station/1/query' % CONFIG.fdsnws.station_host,
                               data=req_data, headers={'Content-Type': 'text/plain'})
    inv = urlopen(r).read()
    with open(inv_filename, 'w') as f:
        f.write(inv.decode('utf-8'))
    prog = os.path.join(CONFIG.seiscomp.root, 'bin', 'fdsnxml2inv')
    conv = subprocess.Popen([prog, inv_filename], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    sc3ml, _ = conv.communicate()
    with open(inv_filename, 'w') as f:
        f.write(sc3ml.decode('utf-8'))
    return inv_filename

def commit_with_scdispatch(qml):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    # print(sc3ml)
    jquake = quakeml_to_jquake(qml)
    write_sc3ml(jquake, sc3ml)
    scdispatch = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'scdispatch',
        '-H', CONFIG.seiscomp.messaging_host,
        '-O', 'merge',
        '-i', sc3ml,
        '--debug'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error_message = scdispatch.communicate()
    os.remove(sc3ml)
    return {
        'message': error_message.decode('utf-8') if PYTHON3 else error_message,
        'return_code': scdispatch.returncode
    }

# def commit_to_pachamama_db(jquake):
#     qml = jquake_to_quakeml(jquake, add_prefix_id=True)
#     json_content = xmltodict.parse(qml)

#     connection = psycopg2.connect(
#         host=CONFIG.pachamama.host,
#         port=CONFIG.pachamama.port,
#         user=CONFIG.pachamama.user,
#         password=CONFIG.pachamama.password,
#         dbname=CONFIG.pachamama.dbname
#     )
#     cursor = connection.cursor()

def get_region(lat, lon):
    return FE.get_region(lat, lon)

def get_event_time(eventid):
    req = 'http://%s/fdsnws/event/1/query?format=text&eventid=%s' % (CONFIG.fdsnws.event_host, eventid)
    try:
        response = urlopen(req).read()
        if PYTHON3:
            response = response.decode('utf-8')
        print(response)
        for line in response.splitlines():
            if line == '' or line.startswith('#'):
                continue
            event_time = line.split('|')[1]
            return event_time
    except:
        return None

def apply_user_rules(method, username, data):
    rules = CONFIG.access.users[username]['rules']
    if method == 'GET':
        if 'starttime' in rules:
            if 'starttime' in data and data['starttime'] < rules['starttime']:
                data['starttime'] = rules['starttime']
            elif 'start' in data and data['start'] < rules['starttime']:
                data['start'] = rules['starttime']
        if 'endtime' in rules:
            if 'endtime' in data and data['endtime'] > rules['endtime']:
                data['endtime'] = rules['endtime']
            elif 'end' in data and data['end'] > rules['endtime']:
                data['end'] = rules['endtime']
        if 'eventid' in data:
            event_time = get_event_time(data['eventid'])
            print(event_time)
            valid = True
            if event_time is not None:
                if 'starttime' in rules and event_time < rules['starttime']:
                    valid = False
                if 'endtime' in rules and event_time > rules['endtime']:
                    valid = False
            if not valid:
                data['eventid'] = '_'
    elif method == 'POST':
        parameters = []
        selection = []
        for line in data.decode('utf-8').splitlines():
            if line == '':
                continue
            if '=' in line:
                parameters.append(line)
                continue
            net, sta, loc, cha, start, end = line.split()
            if 'starttime' in rules:
                if end < rules['starttime']:
                    continue
                if start < rules['starttime']:
                    start = rules['starttime']
            if 'endtime' in rules:
                if start > rules['endtime']:
                    continue
                if end > rules['endtime']:
                    end = rules['endtime']
            selection.append(' '.join([net, sta, loc, cha, start, end]))
        if len(selection) == 0:
            return None
        parameters.extend(selection)
        return '\r\n'.join(parameters).encode('utf-8')
