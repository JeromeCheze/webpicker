import os
import sys
import tempfile
import subprocess
from app import locsat_locator
from lxml import etree
from app import utils
from flask import render_template
from obspy.taup import TauPyModel
from seiscomp.seismology import TravelTimeTableInterface

if utils.PYTHON3:
    from urllib.request import Request, urlopen
else:
    from urllib2 import Request, urlopen


def relocate_with_nll(jquake, profile):
    sc3ml = render_template('sc3ml.xml', version=utils.CONFIG.seiscomp.schema_version, jquake=jquake, quakeml_compatible=True)
    sc3ml = sc3ml.replace(' encoding="UTF-8"', '')
    qml = utils.sc3ml_to_qml(sc3ml, utils.CONFIG.seiscomp.schema_version)
    try:
        req = '%s/nll/%s/%s/' % (utils.CONFIG.nll.url, utils.CONFIG.nll.area, profile)
        response = urlopen(Request(req, data=qml, headers={'Content-Type': 'application/xml'}))
        return_code = response.status if utils.PYTHON3 else response.getcode()
        if return_code == 204:
            raise ValueError('NonLinLoc returned no solution')
        return {
            'message': '',
            'quakeml': response.read().decode('utf-8') if utils.PYTHON3 else response.read()
        }
    except Exception as exception:
        return {
            'message': str(exception),
            'quakeml': qml.decode('utf-8') if utils.PYTHON3 else qml
        }

def relocate_with_scp_api(jquake, profile):
    error, result = locsat_locator.relocate(jquake, profile, utils.CONFIG.fdsnws.station_host)
    if result is None:
        result = jquake
    sc3ml = render_template('sc3ml.xml', version=utils.CONFIG.seiscomp.schema_version, jquake=result, quakeml_compatible=True)
    sc3ml = sc3ml.replace(' encoding="UTF-8"', '')
    qml = utils.sc3ml_to_qml(sc3ml, utils.CONFIG.seiscomp.schema_version)
    return {
        'message': error,
        'quakeml': qml.decode('utf-8') if utils.PYTHON3 else qml
    }

def relocate_with_screloc(jquake, profile):
    inventory = utils.get_inventory(jquake)
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")

    if utils.DEBUG:
        sys.stderr.write('initial sc3ml file from jquake: %s\n' % sc3ml)

    utils.write_sc3ml(jquake, sc3ml, utils.CONFIG.seiscomp.schema_version)
    screloc_cmd = [
        utils.SEISCOMP_PROGRAM, 'exec', 'screloc',
        '--inventory-db', inventory,
        '--locator', 'LOCSAT',
        '--profile', profile,
        '--author', 'webpicker',
        '--agencyID', 'OCA',
        '--use-weight', '1',
        '--ep', sc3ml,
        '--replace'
    ]

    if utils.DEBUG:
        sys.stderr.write('%s\n' % ' '.join(screloc_cmd))

    screloc = subprocess.Popen(screloc_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    raw_result, error_message = screloc.communicate()

    # because relocation using NonLinLoc dump a lot of text before the sc3ml result
    start_xml_index = raw_result.index('<?xml')
    result = raw_result[start_xml_index:]

    if utils.DEBUG:
        _, screloc_result = tempfile.mkstemp(suffix=".sc3ml")
        sys.stderr.write('screloc result: %s\n' % screloc_result)
        with open(screloc_result, 'w') as f:
            f.write(result)

    dom = etree.fromstring(result)
    utils.update_sc3ml_origin_reference(dom)
    newdom = utils.apply_xslt(etree.ElementTree(dom), utils.get_sc3ml_to_qml_xslt(utils.CONFIG.seiscomp.schema_version, utils.CONFIG.seiscomp.root))

    if utils.DEBUG:
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

def compute_magnitudes_with_scamp_and_scmag(jquake):
    # 1) get inventory
    inventory = utils.get_inventory(jquake)

    # 2) save sc3ml
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    utils.write_sc3ml(jquake, sc3ml, utils.CONFIG.seiscomp.schema_version)

    # 3) compute amplitudes with scamp
    _, scamp_result = tempfile.mkstemp(suffix='.sc3ml')
    scamp_cmd = [
        utils.SEISCOMP_PROGRAM, 'exec', 'scamp',
        '--inventory-db', inventory,
        '--config-db', utils.CONFIG.seiscomp.config_filename,
        # '-I', data,
        '-I', 'fdsnws://%s' % utils.CONFIG.fdsnws.dataselect_host,
        '--ep', sc3ml
    ]
    scamp = subprocess.Popen(scamp_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message = scamp.communicate()
    with open(scamp_result, 'w') as f:
        f.write(result.decode('utf-8') if utils.PYTHON3 else result)

    if utils.DEBUG:
        sys.stderr.write('initial sc3ml file from jquake: %s\n' % sc3ml)
        # sys.stderr.write('mseed data: %s\n' % data)
        sys.stderr.write('scamp cmd: %s\n' % ' '.join(scamp_cmd))
        sys.stderr.write('scamp result: %s\n' % scamp_result)
    else:
        os.remove(sc3ml)
        # os.remove(data)

    # 4) compute magnitudes with scmag
    scmag_cmd = [
        utils.SEISCOMP_PROGRAM, 'exec', 'scmag',
        '--inventory-db', inventory,
        '--config-db', utils.CONFIG.seiscomp.config_filename,
        '--ep', scamp_result
    ]
    if utils.DEBUG:
        sys.stderr.write('scmag cmd: %s\n' % ' '.join(scmag_cmd))
    scmag = subprocess.Popen(scmag_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result, error_message2 = scmag.communicate()
    error_message += error_message2
    if utils.PYTHON3:
        result = result.decode('utf-8')
        result = result.replace(' encoding="UTF-8"', '')
    dom = etree.fromstring(result)
    utils.update_sc3ml_origin_reference(dom)
    utils.fix_scmag_magnitude_public_id(dom)
    newdom = utils.apply_xslt(etree.ElementTree(dom), utils.get_sc3ml_to_qml_xslt(utils.CONFIG.seiscomp.schema_version, utils.CONFIG.seiscomp.root))

    if utils.DEBUG:
        _, scmag_result = tempfile.mkstemp(suffix='.sc3ml')
        sys.stderr.write('scmag result: %s\n' % scmag_result)
        with open(scmag_result, 'w') as f:
            f.write(result)
    else:
        os.remove(scamp_result)
        os.remove(inventory)
    qml = etree.tostring(newdom)
    return {
        'message': error_message.decode('utf-8') if utils.PYTHON3 else error_message,
        'quakeml': qml.decode('utf-8') if utils.PYTHON3 else qml
    }

def get_travel_times(lat, lon, depth, station_pos):
    result = {
        'P': None,
        'S': None
    }
    phase_list = ['P', 'p', 'Pn', 'Pg', 'Pdiff', 'S', 's']
    model = TauPyModel(model="iasp91")
    arrivals = model.get_travel_times_geo(depth, lat, lon, station_pos[0], station_pos[1], phase_list)
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

def get_locsat_travel_times(evlat, evlon, evdepth, stalat, stalon, stael=0):
    ttt = TravelTimeTableInterface.Create('LOCSAT')
    ttt.setModel('iasp91')
    return {
        'P': ttt.compute('P', evlat, evlon, evdepth, stalat, stalon, stael).time,
        'S': ttt.compute('S', evlat, evlon, evdepth, stalat, stalon, stael).time
    }
