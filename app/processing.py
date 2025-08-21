import os
import sys
import json
import tempfile
import subprocess
from app import utils
from app import locsat_locator
from app.model import TTTQuery
from datetime import datetime, UTC
from urllib.request import Request, urlopen
from seiscomp.seismology import TravelTimeTableInterface

def relocate_with_nll(qml, profile):
    try:
        # req = '%s/nll/%s/%s/' % (utils.CONFIG.nll.url, utils.CONFIG.nll.area, profile)
        # response = urlopen(Request(req, data=qml, headers={'Content-Type': 'application/xml'}))
        data = {
            'locator': 'nll',
            'area': utils.CONFIG.nll.area,
            'profile': profile,
            'xml_data': qml.decode('utf-8'),
            'likelyhood': True,
            'keep_one_origin': True,
            'force_preferred_origin': True
        }
        response = urlopen(Request('%s/locate/' % utils.CONFIG.nll.url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'}))
        return_code = response.status
        result = json.load(response)
        if return_code == 204:
            raise ValueError('NonLinLoc returned no solution')
        return {
            'message': result['message'],
            'quakeml': result['data']
        }
    except Exception as exception:
        return {
            'message': str(exception),
            'quakeml': qml
        }

def relocate_with_scp_api(qml, profile):
    jquake = utils.quakeml_to_jquake(qml, remove_prefix_id=True)
    error, result = locsat_locator.relocate(jquake, profile, utils.CONFIG.fdsnws.station_host)
    if result is None:
        result = jquake
    qml = utils.jquake_to_quakeml(result)
    return {
        'message': error,
        'quakeml': qml
    }

def compute_magnitudes_with_scamp_and_scmag(qml):
    scp_config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.xml')
    
    jquake = utils.quakeml_to_jquake(qml, remove_prefix_id=True)
    # 1) get inventory
    inventory = utils.get_inventory(jquake)

    # 2) save sc3ml
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    utils.write_sc3ml(jquake, sc3ml)
    utils.logger.debug('initial sc3ml file from jquake: %s\n' % sc3ml)

    # 3) compute amplitudes with scamp
    _, scamp_result = tempfile.mkstemp(suffix='.sc3ml')
    scamp_cmd = [
        os.path.join(utils.CONFIG.seiscomp.root, 'bin', 'scamp'),
        '--inventory-db', inventory,
        '--config-db', scp_config_file,
        '-I', 'fdsnws://%s' % utils.CONFIG.fdsnws.dataselect_host,
        '--ep', sc3ml
    ]
    scamp = subprocess.Popen(scamp_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = scamp.communicate()
    with open(scamp_result, 'w') as f:
        f.write(result.decode('utf-8'))
    utils.logger.debug('scamp cmd: %s\n' % ' '.join(scamp_cmd))
    utils.logger.debug('scamp return code: %s\n' % scamp.returncode)
    utils.logger.debug('scamp result: %s\n' % scamp_result)

    # 4) compute magnitudes with scmag
    scmag_cmd = [
        os.path.join(utils.CONFIG.seiscomp.root, 'bin', 'scmag'),
        '--inventory-db', inventory,
        '--config-db', scp_config_file,
        '--ep', scamp_result
    ]
    scmag = subprocess.Popen(scmag_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message2 = scmag.communicate()
    error_message += error_message2
    utils.logger.debug('scmag cmd: %s\n' % ' '.join(scmag_cmd))
    utils.logger.debug('scmag return code: %s\n' % scmag.returncode)

    result = result.decode('utf-8')
    result = result.replace(' encoding="UTF-8"', '')

    qml = utils.sc3ml_to_quakeml(result, add_prefix_id=False)

    if utils.DEBUG:
        _, scmag_result = tempfile.mkstemp(suffix='.sc3ml')
        _, qml_result = tempfile.mkstemp(suffix='.xml')
        utils.logger.debug('scmag result: %s\n' % scmag_result)
        utils.logger.debug('qml result: %s\n' % qml_result)
        with open(scmag_result, 'w') as f:
            f.write(result)
        with open(qml_result, 'w') as f:
            f.write(qml)
    else:
        os.remove(sc3ml)
        os.remove(inventory)
        os.remove(scamp_result)
    return {
        'message': error_message.decode('utf-8'),
        'quakeml': qml
    }

def takeoffangle(query: TTTQuery):
    ttt = TravelTimeTableInterface.Create('LOCSAT')
    ttt.setModel('iasp91')
    result = {}
    for netsta, pos in query.station.items():
        result[netsta] = ttt.compute('P', query.latitude, query.longitude, query.depth, pos[0], pos[1], pos[2]).takeoff
    return result

def get_locsat_travel_times(query: TTTQuery):
    ttt = TravelTimeTableInterface.Create('LOCSAT')
    ttt.setModel('iasp91')
    result = {}
    for netsta, pos in query.station.items():
        try:
            result[netsta] = {
                'ttt': {
                    'P': ttt.compute('P', query.latitude, query.longitude, query.depth, pos[0], pos[1], pos[2]).time,
                    'S': ttt.compute('S', query.latitude, query.longitude, query.depth, pos[0], pos[1], pos[2]).time
                }
            }
        except:
            result[netsta] = {'ttt': {'P': 0, 'S': 0}}
    return result

def compute_focal_mechanisms_with_skhash(qml, params):
    jquake = utils.quakeml_to_jquake(qml)
    dir_path = tempfile.mkdtemp()
    try:
        print(dir_path)
        ctrl_filename = os.path.join(dir_path, 'in.txt')
        qml_filename = os.path.join(dir_path, 'in.xml')
        out_filename = os.path.join(dir_path, 'out.txt')
        ctrl_content = [
            '$input_format_fpfile', 'quakeml', '',
            '$flip_takeoff', 'True', '',
            '$fpfile', qml_filename, '',
            '$outfile1', out_filename, ''
        ]
        for key, value in params.items():
            ctrl_content.append(f'${key}')
            ctrl_content.append(value)
            ctrl_content.append('')
        with open(ctrl_filename, 'w') as f:
            f.write('\n'.join(ctrl_content))
        with open(qml_filename, 'wb') as f:
            f.write(qml)
        skhash = subprocess.Popen([
            utils.CONFIG.skhash.python_interpreter,
            utils.CONFIG.skhash.path,
            ctrl_filename
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = skhash.communicate()
        error_message = f'STDOUT:\n{stdout.decode("utf-8")}\n\nSTDERR:\n{stderr.decode("utf-8")}'
        if not os.path.exists(out_filename):
            return {'message': error_message, 'quakeml': qml}
        with open(out_filename, 'r') as f:
            content = f.read().splitlines()
        cols = content[0].split(',')
        fm_list = [dict(zip(cols, x.split(','))) for x in content[1:]]
        fm_list.sort(key=lambda x: float(x['polarity_misfit']))
        fms = []
        now = datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')
        for fm in fm_list:
            fms.append({
                '@publicID': utils.gen_id(),
                'triggeringOriginID': jquake[0]['preferredOriginID'],
                'nodalPlanes': {
                    'nodalPlane1': {
                        'strike': {'value': fm['strike']},
                        'dip': {'value': fm['dip']},
                        'rake': {'value': fm['rake']}
                    }
                },
                'stationPolarityCount': fm['num_p_pol'],
                'misfit': float(fm['polarity_misfit']) / 100,
                'stationDistributionRatio': float(fm['sta_distribution_ratio']) / 100,
                'methodID': 'SKHASH',
                'evaluationMode': 'automatic',
                'comment': [{'text': json.dumps(fm)}],
                'creationInfo': {
                    'agencyID': utils.CONFIG.agency,
                    'author': 'SKHASH',
                    'creationTime': now
                }
            })
        jquake[0]['focalMechanism'] = fms
        result = utils.jquake_to_quakeml(jquake)
        return {'message': error_message, 'quakeml': result}
    finally:
        for f in os.listdir(dir_path):
            os.remove(os.path.join(dir_path, f))
        os.rmdir(dir_path)