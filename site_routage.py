#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
from functools import wraps
from app import utils, processing
from flask import Flask, request, session, render_template, Response, abort, redirect

if utils.PYTHON3:
    from urllib.request import urlopen, Request, HTTPError
    from urllib.parse import urlencode
else:
    from urllib2 import urlopen, Request, HTTPError
    from urllib import urlencode


app = Flask(__name__,
            static_folder = "./dist/static",
            template_folder = "./dist")
app.debug = True
app.secret_key = '\x02\xcf:\xc5\x88%K\xd2\x0fl\x8b}\xd1\xd9\xeew\xd8\x9e^0)\xa5\x1c\xb1'


FDSN_EVENT_FORMAT = 'xml'


def check_auth(username, password):
    """This function is called to check if a username /
    password combination is valid.
    """
    if username in utils.CONFIG.access.users and utils.CONFIG.access.users[username]['password'] == password:
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
        if utils.CONFIG.access.restricted and (not auth or not check_auth(auth.username, auth.password)):
            return authenticate()
        return f(*args, **kwargs)
   return decorated

AUTHOR_STATUS = utils.AuthorStatusHandler(utils.CONFIG.author_status_filename)

@app.errorhandler(404)
def not_found(e):
    return index()

@app.route('/')
@requires_auth
def index():
    if 'id' not in session:
        session['id'] = utils.gen_id()
    return render_template('index.html')


# User specific actions
@app.route('/user/logout')
@requires_auth
def logout():
    session['logout'] = True
    return redirect('/webpicker_playback/')

@app.route('/user/set', methods=['GET'])
@requires_auth
def set_session_author():
    session['author'] = request.args['author']
    return Response('true', mimetype="application/json")

@app.route('/user/status', methods=['GET'])
def get_author_status():
    if 'eventid' in request.args and 'action' in request.args:
        AUTHOR_STATUS.set_status(session['id'], session.get('author'), request.args['eventid'], request.args['action'])
        return Response('true', mimetype='application/json')
    return Response(json.dumps(AUTHOR_STATUS.get_status()), mimetype='application/json')

@app.route('/api/update_scp3_config', methods=['GET'])
def update_scp3_config():
    utils.dump_seiscomp3_config()
    return 'OK'

# Event actions
@app.route('/api/detector', methods=['GET'])
@requires_auth
def get_detector_picks():
    net, sta, loc, cha = request.args['wfid'].split('.')
    args = {
        'network': net,
        'station': sta,
        'location': loc if loc != '' else '--',
        'channel': cha[:2],
        'starttime': request.args['starttime'],
        'endtime': request.args['endtime'],
        'url': 'http://%s' % utils.CONFIG.fdsnws.dataselect_host,
        'get_probability': request.args['probability']
    }
    req = Request(utils.CONFIG.detector.url,
                  data=json.dumps(args).encode('utf-8'),
                  headers={'Content-Type': 'application/json'})
    return Response(urlopen(req).read(), mimetype='application/json')

@app.route('/api/denoiser', methods=['GET'])
@requires_auth
def get_denoised_waveforms():
    args = request.args.to_dict()
    args['url'] = f'http://{utils.CONFIG.fdsnws.dataselect_host}'
    req = Request(utils.CONFIG.denoiser.url,
                  data=json.dumps(args).encode('utf-8'),
                  headers={'Content-Type': 'application/json'})
    response = urlopen(req)
    if utils.PYTHON3:
        return Response(response.read(), mimetype=response.headers.get_content_type())
    else:
        return Response(response.read(), mimetype=response.headers.type)

@app.route('/api/ttt', methods=['POST'])
@requires_auth
def get_ttt():
    data = request.get_json()
    result = {}
    for netsta, pos in data['station'].items():
        try:
            result[netsta] = { 'ttt': processing.get_locsat_travel_times(data['latitude'], data['longitude'], data['depth'], pos[0], pos[1], pos[2]) }
        except:
            result[netsta] = { 'ttt': { 'P': 0, 'S': 0 } }
    nll_ttt_data = json.dumps(data)
    if utils.PYTHON3:
        nll_ttt_data = nll_ttt_data.encode('utf-8')
    nll_ttt = json.load(urlopen(Request('%s/ttt/%s/iasp91/' % (utils.CONFIG.nll.url, utils.CONFIG.nll.area), data=nll_ttt_data, headers={'Content-Type': 'application/json'})))
    for netsta, ttt in nll_ttt.items():
        if netsta not in result:
            result[netsta] = {}
        result[netsta]['nll_ttt'] = ttt['ttt']
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/api/takeoffangle', methods=['POST'])
@requires_auth
def get_takeoffangle():
    data = request.get_json()
    result = {}
    for sta, distance in data['station'].items():
        result[sta] = processing.takeoffangle(data['depth'], distance)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/api/region', methods=['GET'])
@requires_auth
def get_region_name():
    longitude = float(request.args.get('longitude'))
    latitude = float(request.args.get('latitude'))
    return Response(json.dumps(utils.get_region(longitude, latitude)), mimetype='application/json')

@app.route('/api/compute_magnitudes', methods=['POST'])
@requires_auth
def compute_magnitudes():
    jquake = request.get_json()
    result = processing.compute_magnitudes_with_scamp_and_scmag(jquake)
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/api/relocate', methods=['POST'])
@requires_auth
def relocate():
    jquake = request.get_json()
    locator = request.args.get('locator')
    if locator == 'LOCSAT':
        # result = relocate_with_screloc(jquake, request.args.get('profile'))
        result = processing.relocate_with_scp_api(jquake, request.args.get('profile'))
    elif locator == 'NonLinLoc':
        result = processing.relocate_with_nll(jquake, request.args.get('profile'))
    return Response(json.dumps(result), mimetype='application/json')

@app.route('/api/commit', methods=['POST'])
@requires_auth
def commit():
    jquake = request.get_json()
    AUTHOR_STATUS.message_to_all(utils.gen_id(), {
        'action': 'commit',
        'eventid': jquake[0]['public_id'].split('/')[-1],
        'author': session.get('author')
    })
    result = utils.commit_with_scdispatch(jquake)
    return Response(json.dumps(result), mimetype='application/json')


# Proxy to FDSNWS
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
            host = 'http://%s/fdsnws/event' % utils.CONFIG.fdsnws.event_host
        elif service == 'station':
            host = 'http://%s/fdsnws/station' % utils.CONFIG.fdsnws.station_host
        elif service == 'dataselect':
            host = 'http://%s/fdsnws/dataselect' % utils.CONFIG.fdsnws.dataselect_host
        req = '%s%s' % (host, path)
        try:
            if request.method == 'GET':
                args = request.args.to_dict(flat=True)
                if service == 'event' and FDSN_EVENT_FORMAT != 'xml':
                    args['format'] = FDSN_EVENT_FORMAT
                if request.authorization:
                    utils.apply_user_rules('GET', request.authorization.username, args)
                response = urlopen('%s?%s' % (req, urlencode(args)))
            elif request.method == 'POST':
                # print(request.data)
                data = request.data
                if request.authorization:
                    data = utils.apply_user_rules('POST', request.authorization.username, data)
                    if data is None:
                        return ''
                r = Request(req, data=data, headers={'Content-Type': request.headers['Content-Type']})
                response = urlopen(r)

        except HTTPError as err:
            abort(err.code)
        result = response.read()
        if service == 'event' and FDSN_EVENT_FORMAT == 'sc3ml':
            result = utils.sc3ml_to_qml(result)
        if utils.PYTHON3:
            return Response(result, mimetype=response.headers.get_content_type())
        else:
            return Response(result, mimetype=response.headers.type)
    else:
        return urlopen('http://%s/fdsnws/' % utils.CONFIG.fdsnws.event_host).read()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002)
