import os
import sys
import json
import tempfile
import subprocess
from lxml import etree
from flask import render_template
from random import randint
from datetime import datetime
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
CONFIG = load_config('/var/www/webpicker/config.json')
SEISCOMP_PROGRAM = os.path.join(CONFIG.seiscomp.root, 'bin', 'seiscomp')


class AuthorStatusHandler(object):
    def __init__(self, filename):
        self.__status = {}
        self.__filename = filename
        self.__clean_threshold = 120

    def _load(self):
        if os.path.exists(self.__filename):
            with open(self.__filename, 'r') as f:
                if PYTHON3:
                    self.__status = json.loads(f.read())
                else:
                    self.__status = json.load(f)
        return self

    def _save(self):
        with open(self.__filename, 'w') as f:
            json.dump(self.__status, f, indent=2)
        return self

    def _clean(self):
        now = datetime.utcnow()
        authors_to_del = []
        msg_to_del = []
        for curr_author_id, curr_event_status in self.__status.items():
            if curr_author_id == '__message__':
                for msg_id, msg in curr_event_status.items():
                    t = datetime.strptime(msg['time'], '%Y-%m-%dT%H:%M:%SZ')
                    delta = now - t
                    if delta.total_seconds() > self.__clean_threshold:
                        msg_to_del.append(msg_id)
            else:
                t = datetime.strptime(curr_event_status['time'], '%Y-%m-%dT%H:%M:%SZ')
                delta = now - t
                if delta.total_seconds() > self.__clean_threshold:
                    authors_to_del.append(curr_author_id)
        for curr_author_id in authors_to_del:
            if curr_author_id in self.__status:
                del self.__status[curr_author_id]
        if len(msg_to_del) > 0:
            for msg_id in msg_to_del:
                del self.__status['__message__'][msg_id]
        return self

    def message_to_all(self, msg_id, msg):
        self._load()
        msg_key = '__message__'
        if msg_key not in self.__status:
            self.__status[msg_key] = dict()
        now = datetime.utcnow()
        msg['time'] = now.strftime('%Y-%m-%dT%H:%M:%SZ')
        self.__status[msg_key][msg_id] = msg
        return self._clean()._save()

    def set_status(self, authorid, author, eventid, action):
        if author is None:
            author = 'unknown'
        now = datetime.utcnow()
        self._load()
        self.__status[authorid] = {
            'author': author,
            'eventid': eventid,
            'action': action,
            'time': now.strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        return self._clean()._save()

    def get_status(self):
        self._load()
        if os.path.exists(self.__filename):
            now = int(datetime.now().strftime('%s'))
            m_time = now - os.path.getmtime(self.__filename)
            # print(m_time)
            if m_time > self.__clean_threshold:
                self._clean()._save()
        return self.__status


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

def get_sc3ml_to_qml_xslt(schema_version, seiscomp_root):
    XSL_SC3ML_TO_QML1_2 = {
        '0.7':  '%SEISCOMP_ROOT%/share/xml/0.7/sc3ml_0.7__quakeml_1.2.xsl',
        '0.8':  '%SEISCOMP_ROOT%/share/xml/0.8/sc3ml_0.8__quakeml_1.2.xsl',
        '0.9':  '%SEISCOMP_ROOT%/share/xml/0.9/sc3ml_0.9__quakeml_1.2.xsl',
        '0.10': '%SEISCOMP_ROOT%/share/xml/0.10/sc3ml_0.10__quakeml_1.2.xsl',
        '0.11': '%SEISCOMP_ROOT%/share/xml/0.11/sc3ml_0.11__quakeml_1.2.xsl',
        '0.12': '%SEISCOMP_ROOT%/share/xml/0.12/sc3ml_0.12__quakeml_1.2.xsl'
    }
    return XSL_SC3ML_TO_QML1_2[schema_version].replace('%SEISCOMP_ROOT%', seiscomp_root)

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

def sc3ml_to_qml(sc3ml_str, sc3ml_version):
    dom = etree.fromstring(sc3ml_str)
    newdom = apply_xslt(dom, get_sc3ml_to_qml_xslt(sc3ml_version, CONFIG.seiscomp.root))
    return etree.tostring(newdom)

def write_sc3ml(jquake, filename, version, quakeml_compatible=False):
    with open(filename, 'w') as f:
        f.write(render_template('sc3ml.xml', version=version, jquake=jquake, quakeml_compatible=quakeml_compatible))

def get_inventory(jquake):
    data = [
        'level=response',
        'format=sc3ml'
    ]
    t = jquake[0]['origin'][0]['time']['value'][0:19]
    for pick in jquake[0]['pick']:
        wfid = pick['waveform_id']
        loc = wfid['location_code'] if 'location_code' in wfid else '--'
        data.append('%s %s %s %s %s %s' % (
            wfid['network_code'], wfid['station_code'],
            loc, wfid['channel_code'], t, t
        ))
    req_data = '\n'.join(data).encode('utf-8') if PYTHON3 else '\n'.join(data)
    r = Request('http://%s/fdsnws/station/1/query' % CONFIG.fdsnws.station_sc3_host,
                               data=req_data, headers={'Content-Type': 'text/plain'})
    inv = urlopen(r).read()
    _, inv_filename = tempfile.mkstemp(suffix=".xml")
    with open(inv_filename, 'w') as f:
        f.write(inv.decode('utf-8') if PYTHON3 else inv)
    return inv_filename

def commit_with_scdispatch(jquake):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    # print(sc3ml)
    write_sc3ml(jquake, sc3ml, CONFIG.seiscomp.schema_version)
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
