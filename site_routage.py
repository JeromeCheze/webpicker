#!/usr/bin/python
# -*- coding: utf-8 -*-
from flask import Flask, request, render_template, Response, abort
from urllib2 import urlopen, Request, HTTPError
from obspy.clients.fdsn import Client
from obspy.taup import TauPyModel
from StringIO import StringIO
from urllib import urlencode
from lxml import etree
import subprocess
import tempfile
import obspy
import json
import os

app = Flask(__name__)
app.debug = True


FDSNWS_EVENT_HOST = os.getenv('FDSNWS_EVENT_HOST', 'encelade.unice.fr:8080')
FDSNWS_STATION_HOST = os.getenv('FDSNWS_STATION_HOST', 'encelade.unice.fr:8080')
FDSNWS_DATASELECT_HOST = os.getenv('FDSNWS_DATASELECT_HOST', 'encelade.unice.fr:8000')

FDSNWS_EVENT = 'http://%s/fdsnws/event' % FDSNWS_EVENT_HOST
FDSNWS_STATION = 'http://%s/fdsnws/station' % FDSNWS_STATION_HOST
FDSNWS_DATASELECT = 'http://%s/fdsnws/dataselect' % FDSNWS_DATASELECT_HOST
#FDSNWS_DATASELECT = 'http://localhost:8002'
# used for screloc :

# generated with scxmldump -I
SC3ML_INVENTORY_FILENAME = os.getenv('SC3ML_INVENTORY_FILENAME', '/home/cheze/encelade_inventory.xml')

# Generated with scxmldump -C
SC3ML_CONFIG_FILENAME = os.getenv('SC3ML_CONFIG_FILENAME', '/home/cheze/encelade_config.xml')

SEISCOMP_ROOT = os.getenv('SEISCOMP_ROOT', '/home/cheze/seiscomp3/')
SEISCOMP_PROGRAM = os.path.join(SEISCOMP_ROOT, 'bin/seiscomp')
SCP3ML_DISPATCH_VERSION = os.getenv('SCP3ML_DISPATCH_VERSION', '0.10')

XSL_SC3ML_TO_QML1_2 = {
  '0.7': os.path.join(SEISCOMP_ROOT, 'share/xml/0.7/sc3ml_0.7__quakeml_1.2.xsl'),
  '0.9': os.path.join(SEISCOMP_ROOT, 'share/xml/0.9/sc3ml_0.9__quakeml_1.2.xsl'),
  '0.10': os.path.join(SEISCOMP_ROOT, 'share/xml/0.10/sc3ml_0.10__quakeml_1.2.xsl')
}

# used for scamp and scmag :
FDSNWS_BASE_URL = 'http://%s' % FDSNWS_DATASELECT_HOST

# used for scdispatch :
SC3_MESSAGING_HOST = os.getenv('SC3_MESSAGING_HOST', 'encelade.unice.fr:4803')

FDSN_EVENT_FORMAT = 'xml'

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
    elif resource_id.startswith('smi:scs'):
        return '/'.join(resource_id.split('/')[2:])
    raise ValueError('Failed to remove prefix of resource ID: %s' % resource_id)

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

# def set_used_arrival_and_save_sc3ml(catalog, sc3ml):
#     fake_sc3ml = StringIO()
#     catalog.write(fake_sc3ml, format="SC3ML")
#     fake_sc3ml.seek(0)
#     dom = etree.parse(fake_sc3ml)
#     root = dom.getroot()
#     namespace = root.nsmap.values()[0]
#     o = root[0].find('{%s}origin' % namespace)
#     for a in o.findall('{%s}arrival' % namespace):
#         w = a.find('{%s}weight' % namespace)
#         tu = etree.Element('timeUsed')
#         tu.text = 'false' if float(w.text) == 0 else 'true'
#         a.append(tu)
#     fake_sc3ml.truncate(0)
#     dom.write(fake_sc3ml)
#     with open(sc3ml, 'w') as f:
#         f.write(fake_sc3ml.getvalue().replace('smi:org.gfz-potsdam.de/geofon/', ''))

def compute_magnitudes_with_scamp_and_scmag(jquake):
    # 1) save sc3ml
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    write_sc3ml(jquake, sc3ml, '0.9')
    catalog = obspy.read_events(sc3ml)

    # 2) download data
    _, data = tempfile.mkstemp(suffix='.mseed')
    req = []
    picks = {}
    for p in catalog.events[0].picks:
        picks[p.resource_id.id] = p
    for a in catalog.events[0].origins[0].arrivals:
        if a.time_weight == 1:
            p = picks[a.pick_id.id]
            net, sta, loc, cha = p.waveform_id.get_seed_string().split('.')
            if loc == '':
                loc = '--'
            t1 = (p.time - 95).isoformat()
            t2 = (p.time + 107).isoformat()
            req.append(' '.join([net, sta, loc, cha, t1, t2]))
    cl = Client(base_url=FDSNWS_BASE_URL)
    st = cl.get_waveforms_bulk('\r\n'.join(req))
    st.write(data, format='MSEED', reclen=512)

    # 3) compute amplitudes with scamp
    _, scamp_result = tempfile.mkstemp(suffix='.sc3ml')
    scamp = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'scamp',
        '--inventory-db', SC3ML_INVENTORY_FILENAME,
        '--config-db', SC3ML_CONFIG_FILENAME,
        '-I', data,
        '--ep', sc3ml
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = scamp.communicate()
    with open(scamp_result, 'w') as f:
        f.write(result)

    # print(sc3ml)
    # print(data)
    # print(scamp_result)

    os.remove(sc3ml)
    os.remove(data)

    # 4) compute magnitudes with scmag
    scmag = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'scmag',
        '--inventory-db', SC3ML_INVENTORY_FILENAME,
        '--config-db', SC3ML_CONFIG_FILENAME,
        '--ep', scamp_result
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message2 = scmag.communicate()
    error_message += error_message2
    dom = etree.fromstring(result)
    update_sc3ml_origin_reference(dom)
    fix_scmag_magnitude_public_id(dom)
    newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML_TO_QML1_2['0.10'])

    # _, scmag_result = tempfile.mkstemp(suffix='.sc3ml')
    # print(scmag_result)
    # with open(scmag_result, 'w') as f:
    #     f.write(result)

    # os.remove(scamp_result)
    return { 'message': error_message, 'quakeml': etree.tostring(newdom) }

def relocate_with_screloc(jquake):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    # print(sc3ml)
    write_sc3ml(jquake, sc3ml, '0.10')
    screloc = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'screloc',
        '--inventory-db', SC3ML_INVENTORY_FILENAME,
        '--locator', 'LOCSAT',
        '--profile', 'iasp91',
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
    newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML_TO_QML1_2['0.10'])
    os.remove(sc3ml)
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
        '-O', 'add',
        '-i', sc3ml,
        '--debug'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = scdispatch.communicate()
    os.remove(sc3ml)
    return {
        'message': error_message,
        'return_code': scdispatch.returncode
    }
    # return 'true'

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

@app.route('/')
def index():
    return render_template('app.html')

@app.route('/ttt', methods=['POST'])
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
        # for a in arrivals:
        #     if (a.name.upper() == 'S')
        #     result[sta]['ttt'][a.name] = a.time
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/compute_magnitudes', methods=['POST'])
def compute_magnitudes():
    jquake = request.get_json()
    result = compute_magnitudes_with_scamp_and_scmag(jquake)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/relocate', methods=['POST'])
def relocate():
    jquake = request.get_json()
    result = relocate_with_screloc(jquake)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/commit', methods=['POST'])
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
