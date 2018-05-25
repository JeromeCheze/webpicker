#!/usr/bin/python
# -*- coding: utf-8 -*-
from flask import Flask, request, render_template, Response, abort
from urllib2 import urlopen, Request, HTTPError
from obspy.taup import TauPyModel
from urllib import urlencode
import json

app = Flask(__name__)
app.debug = True

FDSNWS_ROOT = 'http://encelade.unice.fr:8080/fdsnws'

@app.route('/')
def index():
    return render_template('app.html')

@app.route('/ttt', methods=['POST'])
def get_ttt():
    phase_list = ['P', 'p', 'S', 's']
    model = TauPyModel(model="iasp91")
    data = request.get_json()
    result = {}
    for sta, distance in data['station'].iteritems():
        arrivals = model.get_travel_times(data['depth'], distance, phase_list)
        result[sta] = { 'distance': distance, 'ttt': {} }
        for a in arrivals:
            result[sta]['ttt'][a.name] = a.time
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/fdsnws/', defaults={'service': '', 'path': ''})
@app.route('/fdsnws/<service>/', defaults={'path': ''})
@app.route('/fdsnws/<service>/<path:path>', methods=['GET', 'POST'])
def fdsnws(service, path):
    if path != '':
        path = '/%s' % path

    if service:
        req = '%s/%s%s' % (FDSNWS_ROOT, service, path)
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
