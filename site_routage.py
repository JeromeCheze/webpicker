#!/usr/bin/python
# -*- coding: utf-8 -*-
from flask import Flask, request, render_template, Response, abort
from oca.pyquakeml.generator import QuakeMLGenerator
from urllib2 import urlopen, Request, HTTPError
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

FDSNWS_EVENT = 'http://encelade.unice.fr:8080/fdsnws/event'
FDSNWS_STATION = 'http://encelade.unice.fr:8080/fdsnws/station'
FDSNWS_DATASELECT = 'http://encelade.unice.fr:8000/fdsnws/dataselect'
# used for screloc :
SC3ML_INVENTORY_FILENAME = '/home/cheze/encelade_inventory.sc3ml'
SEISCOMP_PROGRAM = '/home/cheze/seiscomp3/bin/seiscomp'
XSL_SC3ML0_10_TO_QML1_2 = '/home/cheze/seiscomp3/share/xml/0.10/sc3ml_0.10__quakeml_1.2.xsl'
XSL_QML1_2_TO_SC3ML0_9 = '/home/cheze/seiscomp3/share/xml/0.9/quakeml_1.2__sc3ml_0.9.xsl'

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

def relocate_with_screloc(qml_string):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    _, result_sc3ml = tempfile.mkstemp(suffix="-result.sc3ml")
    catalog = obspy.read_events(StringIO(qml_string))
    fake_sc3ml = StringIO()
    catalog.write(fake_sc3ml, format="SC3ML")
    fake_sc3ml.seek(0)
    dom = etree.parse(fake_sc3ml)
    root = dom.getroot()
    namespace = root.nsmap.values()[0]
    o = root[0].find('{%s}origin' % namespace)
    for a in o.findall('{%s}arrival' % namespace):
        w = a.find('{%s}weight' % namespace)
        tu = etree.Element('timeUsed')
        tu.text = 'false' if float(w.text) == 0 else 'true'
        a.append(tu)
    dom.write(sc3ml)
    screloc = subprocess.Popen([
        SEISCOMP_PROGRAM, 'exec', 'screloc',
        '--inventory-db', SC3ML_INVENTORY_FILENAME,
        '--locator', 'LOCSAT',
        '--profile', 'iasp91',
        '--author', 'webpicker',
        '--agencyID', 'oca',
        '--use-weight', '1',
        '--ep',  sc3ml,
        '--replace'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = screloc.communicate()
    print(sc3ml)
    # os.remove(sc3ml)
    print(result_sc3ml)
    with open(result_sc3ml, 'w') as f:
        f.write(result)
    dom = etree.fromstring(result)
    update_sc3ml_origin_reference(dom)
    newdom = apply_xslt(etree.ElementTree(dom), XSL_SC3ML0_10_TO_QML1_2)
    return {
        'message': error_message,
        'quakeml': etree.tostring(newdom)
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

@app.route('/locate', methods=['POST'])
def locate():
    jquake = request.get_json()
    generator = QuakeMLGenerator()
    qml = generator.generate(jquake)
    result = relocate_with_screloc(qml)
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
                result = urlopen('%s?%s' % (req, urlencode(request.args.to_dict(flat=True))))
            elif request.method == 'POST':
                # print(request.data)
                r = Request(req, data=request.data, headers={'Content-Type': request.headers['Content-Type']})
                result = urlopen(r)

        except HTTPError, err:
            abort(err.code)
        return Response(result.read(), mimetype=result.headers.type)
    else:
        return urlopen(FDSNWS_ROOT).read()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)
