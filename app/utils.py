import os
import sys
import json
import tempfile
import xmltodict
import subprocess
from lxml import etree
from .model import Config
from random import randint
from seiscomp.seismology import Regions
from urllib.request import Request, urlopen


def load_config():
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    filename = os.path.join(curr_dir, '..', 'config.json')
    commit_script = os.path.join(curr_dir, '..', 'commit_script.sh')
    with open(filename, 'r') as f:
        config = Config(**json.load(f))
    with open(commit_script, 'w') as f:
        f.write(config.commit_script)
    os.chmod(commit_script, 0o755)
    return config

DEBUG = False
CONFIG = load_config()

def update_config(content):
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    filename = os.path.join(curr_dir, '..', 'config.json')
    with open(filename, 'w') as f:
        json.dump(content, f, indent=2, sort_keys=True)
    global CONFIG
    CONFIG = load_config()

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
    namespace = list(root.nsmap.values())[0]
    origin = root[0].find('{%s}origin' % namespace)
    origin_id = origin.attrib['publicID']
    e = root[0].find('{%s}event' % namespace)
    po = e.find('{%s}preferredOriginID' % namespace)
    oref = e.find('{%s}originReference' % namespace)
    po.text = origin_id
    oref.text = origin_id

def fix_scmag_magnitude_public_id(root):
    namespace = list(root.nsmap.values())[0]
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
        os.path.join(CONFIG.seiscomp.root, 'bin', 'scdispatch'),
        '-H', CONFIG.seiscomp.messaging_host,
        '-O', 'merge',
        '-i', sc3ml,
        '--debug'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error_message = scdispatch.communicate()
    os.remove(sc3ml)
    return {
        'message': error_message.decode('utf-8'),
        'return_code': scdispatch.returncode
    }

def commit_script(qml):
    _, qml_filename = tempfile.mkstemp(suffix='.xml')
    sys.stderr.write(f'{qml_filename}\n')
    with open(qml_filename, 'wb') as f:
        f.write(qml)
    p = subprocess.Popen([CONFIG.commit_script, qml_filename],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error_message = p.communicate()
    os.remove(qml_filename)
    return {
        'message': error_message.decode('utf-8'),
        'return_code': p.returncode
    }

def get_region(lat, lon):
    return Regions.getRegionName(lat, lon)

def get_event_time(eventid):
    req = 'http://%s/fdsnws/event/1/query?format=text&eventid=%s' % (CONFIG.fdsnws.event_host, eventid)
    try:
        response = urlopen(req).read().decode('utf-8')
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
