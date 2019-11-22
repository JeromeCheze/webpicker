#!/usr/bin/python
# -*- coding: utf-8 -*-
from flask import Flask, g, request, session, render_template, Response, abort
from urllib2 import urlopen, Request, HTTPError
from seiscomp3_db_query import SeisComP3DBQuery
from obspy.geodetics import FlinnEngdahl
from obspy.clients.fdsn import Client
from obspy.taup import TauPyModel
from StringIO import StringIO
from obspy import UTCDateTime
from datetime import datetime
from urllib import urlencode
from functools import wraps
from random import randint
from lxml import etree
import subprocess
import tempfile
import obspy
import json
import sys
import os

app = Flask(__name__)
app.debug = True
app.secret_key = '\x02\xcf:\xc5\x88%K\xd2\x0fl\x8b}\xd1\xd9\xeew\xd8\x9e^0)\xa5\x1c\xb1'

EVENTS_CURRENTLY_REVIEWED = {}

FE = FlinnEngdahl()

RESTRICTED = True
DEBUG = False

FDSNWS_EVENT_HOST = os.getenv('FDSNWS_EVENT_HOST', 'ayiti.unice.fr:8080')
FDSNWS_STATION_HOST = os.getenv('FDSNWS_STATION_HOST', 'ayiti.unice.fr:8080')
FDSNWS_DATASELECT_HOST = os.getenv('FDSNWS_DATASELECT_HOST', 'ayiti.unice.fr:8000')

FDSNWS_EVENT = 'http://%s/fdsnws/event' % FDSNWS_EVENT_HOST
FDSNWS_STATION = 'http://%s/fdsnws/station' % FDSNWS_STATION_HOST
FDSNWS_DATASELECT = 'http://%s/fdsnws/dataselect' % FDSNWS_DATASELECT_HOST

# Generated with scxmldump -C
SC3ML_CONFIG_FILENAME = os.getenv('SC3ML_CONFIG_FILENAME', '/home/cheze/Documents/VRAC/thufir_config.xml')

SEISCOMP_ROOT = os.getenv('SEISCOMP_ROOT', '/home/cheze/seiscomp3/')
SEISCOMP_PROGRAM = os.path.join(SEISCOMP_ROOT, 'bin/seiscomp')
SCP3ML_DISPATCH_VERSION = os.getenv('SCP3ML_DISPATCH_VERSION', '0.11')
SCP3ML_BINARY_VERSION = os.getenv('SCP3ML_BINARY_VERSION', '0.11')
SEISCOMP_DB_URI = os.getenv('SEISCOMP_DB_URI', 'postgresql://sc3reader:@babel.unice.fr/seiscomp3_ayiti')

SCP3_DB_QUERY = SeisComP3DBQuery(SEISCOMP_DB_URI)

XSL_SC3ML_TO_QML1_2 = {
  '0.7': os.path.join(SEISCOMP_ROOT, 'share/xml/0.7/sc3ml_0.7__quakeml_1.2.xsl'),
  '0.9': os.path.join(SEISCOMP_ROOT, 'share/xml/0.9/sc3ml_0.9__quakeml_1.2.xsl'),
  '0.10': os.path.join(SEISCOMP_ROOT, 'share/xml/0.10/sc3ml_0.10__quakeml_1.2.xsl'),
  '0.11': os.path.join(SEISCOMP_ROOT, 'share/xml/0.11/sc3ml_0.11__quakeml_1.2.xsl')
}

# used for scamp and scmag :
FDSNWS_BASE_URL = 'http://%s' % FDSNWS_DATASELECT_HOST

# used for scdispatch :
SC3_MESSAGING_HOST = os.getenv('SC3_MESSAGING_HOST', 'ayiti.unice.fr:4803')

FDSN_EVENT_FORMAT = 'xml'

def check_auth(username, password):
    """This function is called to check if a username /
    password combination is valid.
    """
    return username == 's2rhai' and password == '52rh@!'

def authenticate():
    """Sends a 401 response that enables basic auth"""
    return Response(
        'Could not verify your access level for that URL.\n'
        'You have to login with proper credentials', 401,
        {'WWW-Authenticate': 'Basic realm="Login Required"'})

def requires_auth(f):
   @wraps(f)
   def decorated(*args, **kwargs):
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
        self.__clean_threshold = 300

    def _load(self):
        if os.path.exists(self.__filename):
            with open(self.__filename, 'r') as f:
                self.__status = json.load(f)
        return self

    def _save(self):
        with open(self.__filename, 'w') as f:
            json.dump(self.__status, f, indent=2)
        return self

    def _clean(self):
        now = datetime.utcnow()
        authors_to_del = []
        for curr_author_id, curr_event_status in self.__status.iteritems():
            t = datetime.strptime(curr_event_status['time'], '%Y-%m-%dT%H:%M:%SZ')
            delta = now - t
            if delta.total_seconds() > self.__clean_threshold:
                authors_to_del.append(curr_author_id)
        for curr_author_id in authors_to_del:
            if curr_author_id in self.__status:
                del self.__status[curr_author_id]
        return self

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
        now = int(datetime.now().strftime('%s'))
        m_time = now - os.path.getmtime(self.__filename)
        # print(m_time)
        if m_time > self.__clean_threshold:
            self._clean()._save()
        return self.__status

AUTHOR_STATUS = AuthorStatusHandler('author_status.json')

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
        f.write(render_template('sc3ml.xml', version=version, jquake=jquake))

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
    r = Request('%s/1/query' % FDSNWS_STATION, data='\n'.join(data), headers={'Content-Type': 'text/plain'})
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
            t1 = (t - 95).isoformat()
            t2 = (t + 107).isoformat()
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
        sys.stderr.write('scamg cmd: %s\n' % scmag_cmd)
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
    # print(sc3ml)
    write_sc3ml(jquake, sc3ml, SCP3ML_BINARY_VERSION)
    screloc = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'screloc',
        '--inventory-db', inventory,
        '--locator', locator,
        '--profile', profile,
        '--author', 'webpicker',
        '--agencyID', 'OCA',
        '--use-weight', '1',
        '--ep',  sc3ml,
        '--replace'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = screloc.communicate()
    # _, screloc_result = tempfile.mkstemp(suffix=".sc3ml")
    # print(screloc_result)
    # with open(screloc_result, 'w') as f:
    #     f.write(result)
    dom = etree.fromstring(result)
    update_sc3ml_origin_reference(dom)
    newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML_TO_QML1_2[SCP3ML_BINARY_VERSION])
    os.remove(sc3ml)
    os.remove(inventory)
    # _, qml_result = tempfile.mkstemp(suffix=".sc3ml")
    # print(qml_result)
    # with open(qml_result, 'w') as f:
    #     f.write(etree.tostring(newdom))
    return {
        'message': error_message,
        'quakeml': etree.tostring(newdom)
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
    result, error_message = scdispatch.communicate()
    os.remove(sc3ml)
    return {
        'message': error_message,
        'return_code': scdispatch.returncode
    }

def get_first_arrival_P(arrivals, distance):
    result = None
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
    return render_template('app.html')

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

@app.route('/ttt', methods=['POST'])
@requires_auth
def get_ttt():
    phase_list = ['P', 'p', 'Pn', 'Pg', 'Pdiff', 'S', 's']
    model = TauPyModel(model="iasp91")
    data = request.get_json()
    result = {}
    for sta, distance in data['station'].iteritems():
        arrivals = model.get_travel_times(data['depth'], distance, phase_list)
        result[sta] = { 'distance': distance, 'ttt': {} }
        p_arrival = get_first_arrival_P(arrivals, distance)
        if p_arrival is not None:
            result[sta]['ttt']['P'] = p_arrival.time
        s_arrivals = [a.time for a in arrivals if a.name.upper() == 'S']
        if len(s_arrivals) > 0:
            result[sta]['ttt']['S'] = min(s_arrivals)
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
    result = commit_with_scdispatch(jquake)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/fdsnws/', defaults={'service': '', 'path': ''})
@app.route('/fdsnws/<service>/', defaults={'path': ''})
@app.route('/fdsnws/<service>/<path:path>', methods=['GET', 'POST'])
def fdsnws(service, path):
    if path != '':
        path = '/%s' % path

    if service:
        host = ''
        if service == 'event':
            host = FDSNWS_EVENT
            if SEISCOMP_DB_URI is not None:
                with SCP3_DB_QUERY:
                    return Response(
                        render_template(
                            'quakeml.xml',
                            events=SCP3_DB_QUERY.get_events(request.args)
                        ),
                        mimetype='application/xml'
                    )

        elif service == 'station':
            host = FDSNWS_STATION
            if request.method == 'POST' and SEISCOMP_DB_URI is not None:
                args = parse_station_post_request(request.data)
                if args['format'] == 'text' and args['level'] == 'channel':
                    with SCP3_DB_QUERY:
                        return Response(
                            SCP3_DB_QUERY.get_inventory(args['channel']),
                            mimetype='text/plain'
                        )
        elif service == 'dataselect':
            host = FDSNWS_DATASELECT
        req = '%s%s' % (host, path)
        try:
            if request.method == 'GET':
                args = request.args.to_dict(flat=True)
                if service == 'event' and FDSN_EVENT_FORMAT != 'xml':
                    args['format'] = FDSN_EVENT_FORMAT
                response = urlopen('%s?%s' % (req, urlencode(args)))
            elif request.method == 'POST':
                # print(request.data)
                r = Request(req, data=request.data, headers={'Content-Type': request.headers['Content-Type']})
                response = urlopen(r)

        except HTTPError, err:
            abort(err.code)
        result = response.read()
        if service == 'event' and FDSN_EVENT_FORMAT == 'sc3ml':
            result = sc3ml_to_qml(result, '0.7')
        return Response(result, mimetype=response.headers.type)
    else:
        return urlopen(FDSNWS_ROOT).read()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)
