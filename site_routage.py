#!/usr/bin/python
# -*- coding: utf-8 -*-
from flask import Flask, request, render_template, Response, abort
from urllib2 import urlopen, Request, HTTPError
from obspy.taup import TauPyModel
from urllib import urlencode
import json

app = Flask(__name__)
app.debug = True

FDSNWS_EVENT = 'http://encelade.unice.fr:8080/fdsnws/event'
FDSNWS_STATION = 'http://encelade.unice.fr:8080/fdsnws/station'
FDSNWS_DATASELECT = 'http://encelade.unice.fr:8000/fdsnws/dataselect'

def get_first_arrival_P(arrivals, distance):
    result = None
    for a in arrivals:
        if a.name.upper() == 'P':
            return a
        if a.name.upper()[0] != 'P':
            continue
        if distance < 120 and a.name in ['Pn', 'Pb', 'Pg', 'Pdiff']:
            return a
    return None

@app.route('/')
def index():
    return render_template('app.html')

@app.route('/ttt', methods=['POST'])
def get_ttt():
    phase_list = ['P', 'p', 'Pn', 'Pb', 'Pg', 'Pdiff', 'S', 's']
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
