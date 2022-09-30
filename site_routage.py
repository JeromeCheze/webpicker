#!/usr/bin/env python
# -*- coding: utf-8 -*-
PYTHON3 = False
from flask import Flask, request, session, render_template, Response, abort, redirect
if PYTHON3:
    from urllib.request import urlopen, Request, HTTPError
    from urllib.parse import urlencode
else:
    from urllib2 import urlopen, Request, HTTPError
    from urllib import urlencode
from obspy.geodetics import FlinnEngdahl
from obspy.clients.fdsn import Client
from obspy.taup import TauPyModel
from obspy import UTCDateTime
from datetime import datetime
from functools import wraps
from random import randint
from lxml import etree
import subprocess
import tempfile
import obspy
import json
import sys
import os

app = Flask(__name__,
            static_folder = "./dist/static",
            template_folder = "./dist")
app.debug = True
app.secret_key = '\x02\xcf:\xc5\x88%K\xd2\x0fl\x8b}\xd1\xd9\xeew\xd8\x9e^0)\xa5\x1c\xb1'

EVENTS_CURRENTLY_REVIEWED = {}

FE = FlinnEngdahl()

DEBUG = False

RESTRICTED = os.getenv('WEBPICKER_RESTRICT_ACCESS', 'true') == 'true'
USER_FILE = os.getenv('WEBPICKER_USER_FILE', '/var/www/webpicker_playback/users.json')
#FDSNWS_EVENT_HOST = os.getenv('FDSNWS_EVENT_HOST', 'encelade.unice.fr:8000')
FDSNWS_EVENT_HOST = 'localhost:8002'
FDSNWS_STATION_HOST = os.getenv('FDSNWS_STATION_HOST', 'encelade.unice.fr:8000')
FDSNWS_SC3_STATION_HOST = os.getenv('FDSNWS_SC3_STATION_HOST', 'encelade.unice.fr:8080')
FDSNWS_DATASELECT_HOST = os.getenv('FDSNWS_DATASELECT_HOST', 'encelade.unice.fr:8000')

FDSNWS_ROOT = 'http://%s' % FDSNWS_EVENT_HOST
FDSNWS_EVENT = 'http://%s/fdsnws/event' % FDSNWS_EVENT_HOST
FDSNWS_STATION = 'http://%s/fdsnws/station' % FDSNWS_STATION_HOST
FDSNWS_SC3_STATION = 'http://%s/fdsnws/station' % FDSNWS_SC3_STATION_HOST
FDSNWS_DATASELECT = 'http://%s/fdsnws/dataselect' % FDSNWS_DATASELECT_HOST

# Generated with scxmldump -C
#SC3ML_CONFIG_FILENAME = os.getenv('SC3ML_CONFIG_FILENAME', '/var/www/webpicker_playback/config.xml')
SC3ML_CONFIG_FILENAME = '/var/www/webpicker_playback/config.xml'

SEISCOMP_ROOT = os.getenv('SEISCOMP_ROOT', '/home/sysop/seiscomp3/')
SEISCOMP_PROGRAM = os.path.join(SEISCOMP_ROOT, 'bin/seiscomp')
SCP3ML_DISPATCH_VERSION = os.getenv('SCP3ML_DISPATCH_VERSION', '0.11')
SCP3ML_BINARY_VERSION = os.getenv('SCP3ML_BINARY_VERSION', '0.11')
SEISCOMP_DB_URI = os.getenv('SEISCOMP_DB_URI', 'postgresql://sc3reader:@babel.unice.fr/seiscomp3')

XSL_SC3ML_TO_QML1_2 = {
  '0.7': os.path.join(SEISCOMP_ROOT, 'share/xml/0.7/sc3ml_0.7__quakeml_1.2.xsl'),
  '0.8': os.path.join(SEISCOMP_ROOT, 'share/xml/0.8/sc3ml_0.8__quakeml_1.2.xsl'),
  '0.9': os.path.join(SEISCOMP_ROOT, 'share/xml/0.9/sc3ml_0.9__quakeml_1.2.xsl'),
  '0.10': os.path.join(SEISCOMP_ROOT, 'share/xml/0.10/sc3ml_0.10__quakeml_1.2.xsl'),
  '0.11': os.path.join(SEISCOMP_ROOT, 'share/xml/0.11/sc3ml_0.11__quakeml_1.2.xsl')
}

# used for scamp and scmag :
FDSNWS_BASE_URL = 'http://%s' % FDSNWS_DATASELECT_HOST

# used for scdispatch :
#SC3_MESSAGING_HOST = os.getenv('SC3_MESSAGING_HOST', 'thufir.unice.fr:4805')
SC3_MESSAGING_HOST = 'localhost:4809'

FDSN_EVENT_FORMAT = 'xml'

USERS = {}
if RESTRICTED and USER_FILE is not None and os.path.exists(USER_FILE):
    with open(USER_FILE, 'r') as f:
        USERS = json.load(f)

with open(os.path.join(os.path.dirname(__file__), 'iasp91_table.json'), 'r') as f:
    IASP91_TABLE = json.load(f)

def dump_seiscomp3_config():
    fd, conf_filename = tempfile.mkstemp()
    scxmldump = subprocess.Popen([SEISCOMP_PROGRAM, 'exec', 'scxmldump', '-f', '-C', '-d', SEISCOMP_DB_URI], stdout=subprocess.PIPE)
    config, _ = scxmldump.communicate()
    f = os.fdopen(fd, 'w')
    f.write(config)
    f.close()
    os.rename(conf_filename, SC3ML_CONFIG_FILENAME)

#dump_seiscomp3_config()

def check_auth(username, password):
    """This function is called to check if a username /
    password combination is valid.
    """
    if username in USERS and USERS[username]['password'] == password:
        session['logout'] = False
        return True
    return False

def authenticate():
    """Sends a 401 response that enables basic auth"""
    return Response(
        'Could not verify your access level for that URL.\n'
        'You have to login with proper credentials', 401,
        {'WWW-Authenticate': 'Basic realm="Login Required"'})

def requires_auth(f):
   @wraps(f)
   def decorated(*args, **kwargs):
        if session.get('logout', False):
            session['logout'] = False
            return authenticate()
        auth = request.authorization
        if RESTRICTED and (not auth or not check_auth(auth.username, auth.password)):
            return authenticate()
        return f(*args, **kwargs)
   return decorated


@app.template_filter('sc3ml_type')
def qml_type_to_sc3ml(event_type):
    if event_type == 'induced or triggered event':
        return 'induced earthquake'
    elif event_type == 'meteorite':
        return 'meteor impact'
    elif event_type == 'other event':
        return 'other'
    else:
        return event_type

@app.template_filter('remove_resource_prefix')
def remove_resource_prefix(resource_id):
    if resource_id.startswith('smi:org.gfz-potsdam.de/geofon/'):
        return resource_id.replace('smi:org.gfz-potsdam.de/geofon/', '')
    elif resource_id.startswith('smi:'):
        return '/'.join(resource_id.split('/')[2:])
    raise ValueError('Failed to remove prefix of resource ID: %s' % resource_id)

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
        # if action in ['committing', 'browsing'] and authorid in self.__status:
        #     del self.__status[authorid]
        # else:
        #     self.__status[authorid] = {
        #         'author': author,
        #         'eventid': eventid,
        #         'action': action,
        #         'time': now.strftime('%Y-%m-%dT%H:%M:%SZ')
        #     }
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

AUTHOR_STATUS = AuthorStatusHandler('/var/www/webpicker_playback/author_status.json')

def get_event_time(eventid):
    req = '%s/1/query?format=text&eventid=%s' % (FDSNWS_EVENT, eventid)
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
    rules = USERS[username]['rules']
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

def gen_id():
    hexa = ['%x'% x for x in range(0, 16)]
    return ''.join([hexa[randint(0, 15)] for x in range(0, 16)])

def apply_xslt(document, xslt_path):
    xslt = etree.parse(xslt_path)
    transform = etree.XSLT(xslt)
    return transform(document)

def update_sc3ml_origin_reference(root):
    namespace = root.nsmap.values()[0]
    origin = root[0].find('{%s}origin' % namespace)
    origin_id = origin.attrib['publicID']
    e = root[0].find('{%s}event' % namespace)
    po = e.find('{%s}preferredOriginID' % namespace)
    oref = e.find('{%s}originReference' % namespace)
    po.text = origin_id
    oref.text = origin_id

def fix_scmag_magnitude_public_id(root):
    namespace = root.nsmap.values()[0]
    origin = root[0].find('{%s}origin' % namespace)
    mags = origin.findall('{%s}magnitude' % namespace)
    for mag in mags:
        mag.attrib['publicID'] = mag.attrib['publicID'].replace('/', '.')

def sc3ml_to_qml(sc3ml_str, sc3ml_version):
    dom = etree.fromstring(sc3ml_str)
    newdom = apply_xslt(dom, XSL_SC3ML_TO_QML1_2[sc3ml_version])
    return etree.tostring(newdom)

def write_sc3ml(jquake, filename, version):
    with open(filename, 'w') as f:
        f.write(render_template('sc3ml.xml', version=version, jquake=jquake).encode('utf-8'))

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
    r = Request('%s/1/query' % FDSNWS_SC3_STATION, data='\n'.join(data), headers={'Content-Type': 'text/plain'})
    inv = urlopen(r).read()
    _, inv_filename = tempfile.mkstemp(suffix=".xml")
    with open(inv_filename, 'w') as f:
        f.write(inv)
    return inv_filename

def compute_magnitudes_with_scamp_and_scmag(jquake):
    # 1) get inventory
    inventory = get_inventory(jquake)

    # 2) download data
    _, data = tempfile.mkstemp(suffix='.mseed')
    req = []
    picks = {}
    for p in jquake[0]['pick']:
        picks[p['public_id']] = p
    for a in jquake[0]['origin'][0]['arrival']:
        if a['time_weight'] == 1:
            net, sta, loc, cha = 'network_code', 'station_code', 'location_code', 'channel_code'
            p = picks[a['pick_id']]
            wfid = p['waveform_id']
            location = wfid[loc] if loc in wfid else '--'
            t = UTCDateTime(p['time']['value'])
            t1 = (t - 100).isoformat()
            t2 = (t + 130).isoformat()
            req.append(' '.join([wfid[net], wfid[sta], location, wfid[cha], t1, t2]))
    cl = Client(base_url=FDSNWS_BASE_URL)
    st = cl.get_waveforms_bulk('\r\n'.join(req))
    st.write(data, format='MSEED', reclen=512)

    # 3) save sc3ml
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    write_sc3ml(jquake, sc3ml, SCP3ML_BINARY_VERSION)

    # 4) compute amplitudes with scamp
    _, scamp_result = tempfile.mkstemp(suffix='.sc3ml')
    scamp_cmd = [
        SEISCOMP_PROGRAM, 'exec', 'scamp',
        '--inventory-db', inventory,
        '--config-db', SC3ML_CONFIG_FILENAME,
        '-I', data,
        '--ep', sc3ml
    ]
    scamp = subprocess.Popen(scamp_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = scamp.communicate()
    with open(scamp_result, 'w') as f:
        f.write(result)

    if DEBUG:
        sys.stderr.write('initial sc3ml file from jquake: %s\n' % sc3ml)
        sys.stderr.write('mseed data: %s\n' % data)
        sys.stderr.write('scamp cmd: %s\n' % ' '.join(scamp_cmd))
        sys.stderr.write('scamp result: %s\n' % scamp_result)
    else:
        os.remove(sc3ml)
        os.remove(data)

    # 5) compute magnitudes with scmag
    scmag_cmd = [
        SEISCOMP_PROGRAM, 'exec', 'scmag',
        '--inventory-db', inventory,
        '--config-db', SC3ML_CONFIG_FILENAME,
        '--ep', scamp_result
    ]
    if DEBUG:
        sys.stderr.write('scmag cmd: %s\n' % ' '.join(scmag_cmd))
    scmag = subprocess.Popen(scmag_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message2 = scmag.communicate()
    error_message += error_message2
    dom = etree.fromstring(result)
    update_sc3ml_origin_reference(dom)
    fix_scmag_magnitude_public_id(dom)
    newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML_TO_QML1_2[SCP3ML_BINARY_VERSION])

    if DEBUG:
        _, scmag_result = tempfile.mkstemp(suffix='.sc3ml')
        sys.stderr.write('scmag result: %s\n' % scmag_result)
        with open(scmag_result, 'w') as f:
            f.write(result)
    else:
        os.remove(scamp_result)
        os.remove(inventory)
    return { 'message': error_message, 'quakeml': etree.tostring(newdom) }

def relocate_with_screloc(jquake, locator, profile):
    inventory = get_inventory(jquake)
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")

    if DEBUG:
        sys.stderr.write('initial sc3ml file from jquake: %s\n' % sc3ml)

    write_sc3ml(jquake, sc3ml, SCP3ML_BINARY_VERSION)
    screloc_cmd = [
        SEISCOMP_PROGRAM, 'exec', 'screloc',
        '--inventory-db', inventory,
        '--locator', locator,
        '--profile', profile,
        '--author', 'webpicker',
        '--agencyID', 'OCA',
        '--use-weight', '1',
        '--ep',  sc3ml,
        '--replace'
    ]

    if DEBUG:
        sys.stderr.write('%s\n' % ' '.join(screloc_cmd))

    screloc = subprocess.Popen(screloc_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    raw_result, error_message = screloc.communicate()

    # because relocation using NonLinLoc dump a lot of text before the sc3ml result
    start_xml_index = raw_result.index('<?xml')
    result = raw_result[start_xml_index:]

    if DEBUG:
        _, screloc_result = tempfile.mkstemp(suffix=".sc3ml")
        sys.stderr.write('screloc result: %s\n' % screloc_result)
        with open(screloc_result, 'w') as f:
            f.write(result)

    dom = etree.fromstring(result)
    update_sc3ml_origin_reference(dom)
    newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML_TO_QML1_2[SCP3ML_BINARY_VERSION])

    if DEBUG:
        _, qml_result = tempfile.mkstemp(suffix=".sc3ml")
        sys.stderr.write('qml result: %s\n' % qml_result)
        with open(qml_result, 'w') as f:
            f.write(etree.tostring(newdom))
    else:
        os.remove(sc3ml)
        os.remove(inventory)

    return {
        'message': error_message,
        'quakeml': etree.tostring(newdom)
    }

def commit_with_scdb(jquake):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    print(sc3ml)
    write_sc3ml(jquake, sc3ml, SCP3ML_DISPATCH_VERSION)
    scdb = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'scdb',
        '-d', SEISCOMP_DB_URI,
        '-i', sc3ml,
        '--debug'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = scdb.communicate()
    # os.remove(sc3ml)
    msg = '\n'.join(['STDOUT', stdout, '', 'STDERR', stderr])
    return {
        'message': msg,
        'return_code': scdb.returncode
    }

def commit_with_scdispatch(jquake):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    # print(sc3ml)
    write_sc3ml(jquake, sc3ml, SCP3ML_DISPATCH_VERSION)
    scdispatch = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'scdispatch',
        '-H', SC3_MESSAGING_HOST,
        '-O', 'merge',
        '-i', sc3ml,
        '--debug'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error_message = scdispatch.communicate()
    os.remove(sc3ml)
    return {
        'message': error_message,
        'return_code': scdispatch.returncode
    }

def get_first_arrival_P(arrivals, distance):
    for a in arrivals:
        if a.name.upper() == 'P':
            return a
        if a.name.upper()[0] != 'P':
            continue
        if distance < 120 and a.name in ['Pn', 'Pg', 'Pdiff']:
            return a
    return None

def parse_station_post_request(raw_data):
    args = { 'channel': [] }
    for row in raw_data.splitlines():
        if row == '':
            continue
        if '=' in row:
            key, val = row.split('=')
            args[key] = val
        else:
            net, sta, loc, cha, start, end = row.split()
            args['channel'].append({
                'network': net,
                'station': sta,
                'location': '' if loc == '--' else loc,
                'channel': cha,
                'starttime': start,
                'endtime': end,
            })
    return args

def get_travel_times(depth, distance):
    result = {
        'P': None,
        'S': None
    }
    if(depth >= IASP91_TABLE['depth_min']
       and depth <= IASP91_TABLE['depth_max']
       and distance >= IASP91_TABLE['distance_min']
       and distance <= IASP91_TABLE['distance_max']):
        depth_step = float(IASP91_TABLE['depth_max'] - IASP91_TABLE['depth_min']) / len(IASP91_TABLE['table'])
        dist_step = float(IASP91_TABLE['distance_max'] - IASP91_TABLE['distance_min']) / len(IASP91_TABLE['table'][0])
        depth_index = int((depth - IASP91_TABLE['depth_min']) / depth_step)
        dist_index = int((distance - IASP91_TABLE['distance_min']) / dist_step)
        depth_index_next = min(depth_index + 1, len(IASP91_TABLE['table']) - 1)
        dist_index_next = min(dist_index + 1, len(IASP91_TABLE['table'][0]) - 1)
        depth_ratio = (depth - depth_index * depth_step) / depth_step
        dist_ratio = (distance - dist_index * dist_step) / dist_step
        result['P'] = (depth_ratio * (IASP91_TABLE['table'][depth_index][dist_index][0][1] * dist_ratio
                                      + IASP91_TABLE['table'][depth_index][dist_index_next][0][1] * (1 - dist_ratio))
                       + (1 - depth_ratio) * (IASP91_TABLE['table'][depth_index_next][dist_index][0][1] * dist_ratio
                                              + IASP91_TABLE['table'][depth_index_next][dist_index_next][0][1] * (1 - dist_ratio)))
        result['S'] = (depth_ratio * (IASP91_TABLE['table'][depth_index][dist_index][1][1] * dist_ratio
                                      + IASP91_TABLE['table'][depth_index][dist_index_next][1][1] * (1 - dist_ratio))
                       + (1 - depth_ratio) * (IASP91_TABLE['table'][depth_index_next][dist_index][1][1] * dist_ratio
                                              + IASP91_TABLE['table'][depth_index_next][dist_index_next][1][1] * (1 - dist_ratio)))
    else:
        phase_list = ['P', 'p', 'Pn', 'Pg', 'Pdiff', 'S', 's']
        model = TauPyModel(model="iasp91")
        arrivals = model.get_travel_times(depth, distance, phase_list)
        p_arrivals = [a.time for a in arrivals if 'P' in a.name.upper()]
        if len(p_arrivals) > 0:
            result['P'] = min(p_arrivals)
        s_arrivals = [a.time for a in arrivals if a.name.upper() == 'S']
        if len(s_arrivals) > 0:
            result['S'] = min(s_arrivals)
    return result

def takeoffangle(depth, distance):
    model = TauPyModel(model="iasp91")
    arrivals = model.get_travel_times(depth, distance)
    arrivals.sort(key=lambda x: x.time)
    return arrivals[0].takeoff_angle

# def get_event_full_description(eventid):
#     cmd = [
#         SEISCOMP_PROGRAM, 'exec', 'scxmldump',
#         '-d', SEISCOMP_DB_URI,
#         '-E', request.args['eventid'],
#         '-mPAM'
#     ]
#     # print(' '.join(cmd))
#     scxmldump = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
#     result, error_message = scxmldump.communicate()
#     dom = etree.fromstring(result)
#     newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML_TO_QML1_2[SCP3ML_BINARY_VERSION])
#     return etree.tostring(newdom)

@app.route('/')
@requires_auth
def index():
    if 'id' not in session:
        session['id'] = gen_id()
    return render_template('index.html')

@app.route('/logout')
@requires_auth
def logout():
    session['logout'] = True
    return redirect('/webpicker_playback/')

@app.route('/set_author', methods=['GET'])
@requires_auth
def set_session_author():
    session['author'] = request.args['author']
    return Response('true', mimetype="application/json")

@app.route('/author_status', methods=['GET'])
def get_author_status():
    if 'eventid' in request.args and 'action' in request.args:
        AUTHOR_STATUS.set_status(session['id'], session.get('author'), request.args['eventid'], request.args['action'])
        return Response('true', mimetype='application/json')
    return Response(json.dumps(AUTHOR_STATUS.get_status()), mimetype='application/json')

@app.route('/update_scp3_config')
def update_scp3_config():
    dump_seiscomp3_config()
    return 'OK'

@app.route('/ttt', methods=['POST'])
@requires_auth
def get_ttt():
    data = request.get_json()
    result = {}
    for sta, distance in data['station'].items():
        result[sta] = { 'distance': distance, 'ttt': get_travel_times(data['depth'], distance) }
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/takeoffangle', methods=['POST'])
@requires_auth
def get_takeoffangle():
    data = request.get_json()
    result = {}
    for sta, distance in data['station'].items():
        result[sta] = takeoffangle(data['depth'], distance)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/region', methods=['GET'])
@requires_auth
def get_region_name():
    longitude = float(request.args.get('longitude'))
    latitude = float(request.args.get('latitude'))
    return Response(json.dumps(FE.get_region(longitude, latitude)), mimetype='application/json')

@app.route('/compute_magnitudes', methods=['POST'])
@requires_auth
def compute_magnitudes():
    jquake = request.get_json()
    result = compute_magnitudes_with_scamp_and_scmag(jquake)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/relocate', methods=['POST'])
@requires_auth
def relocate():
    jquake = request.get_json()
    result = relocate_with_screloc(jquake, request.args.get('locator'), request.args.get('profile'))
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/commit', methods=['POST'])
@requires_auth
def commit():
    jquake = request.get_json()
    AUTHOR_STATUS.message_to_all(gen_id(), {
        'action': 'commit',
        'eventid': jquake[0]['public_id'].split('/')[-1],
        'author': session.get('author')
    })
    result = commit_with_scdispatch(jquake)
    # result = commit_with_scdb(jquake)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/fdsnws/', defaults={'service': '', 'path': ''})
@app.route('/fdsnws/<service>/', defaults={'path': ''})
@app.route('/fdsnws/<service>/<path:path>', methods=['GET', 'POST'])
@requires_auth
def fdsnws(service, path):
    if path != '':
        path = '/%s' % path

    if service:
        host = ''
        if service == 'event':
            host = FDSNWS_EVENT
        elif service == 'station':
            host = FDSNWS_STATION
        elif service == 'dataselect':
            host = FDSNWS_DATASELECT
        req = '%s%s' % (host, path)
        try:
            if request.method == 'GET':
                args = request.args.to_dict(flat=True)
                if service == 'event' and FDSN_EVENT_FORMAT != 'xml':
                    args['format'] = FDSN_EVENT_FORMAT
                if request.authorization:
                    apply_user_rules('GET', request.authorization.username, args)
                response = urlopen('%s?%s' % (req, urlencode(args)))
            elif request.method == 'POST':
                # print(request.data)
                data = request.data
                if request.authorization:
                    data = apply_user_rules('POST', request.authorization.username, data)
                    if data is None:
                        return ''
                r = Request(req, data=data, headers={'Content-Type': request.headers['Content-Type']})
                response = urlopen(r)

        except HTTPError as err:
            abort(err.code)
        result = response.read()
        if service == 'event' and FDSN_EVENT_FORMAT == 'sc3ml':
            result = sc3ml_to_qml(result, '0.7')
        if PYTHON3:
            return Response(result, mimetype=response.headers.get_content_type())
        else:
            return Response(result, mimetype=response.headers.type)
    else:
        return urlopen(FDSNWS_ROOT).read()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002)
