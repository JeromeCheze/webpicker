import os
import json
import logging
import tempfile
import xmltodict
import subprocess
from typing import Any
from lxml import etree
from .model import Config
from random import randint
from seiscomp.seismology import Regions
from urllib.request import Request, urlopen

DEBUG = False

logger = logging.getLogger(__name__)

def write_scp_config(schema_version: str) -> None:
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    filename = os.path.join(curr_dir, '..', 'config.xml')
    if float(schema_version) < 0.14:
        content = f'''<?xml version="1.0" encoding="UTF-8"?>
<seiscomp xmlns="http://geofon.gfz-potsdam.de/ns/seiscomp3-schema/{schema_version}" version="{schema_version}"><Config/></seiscomp>'''
    else:
        content = f'''<?xml version="1.0" encoding="UTF-8"?>
<seiscomp xmlns="http://geofon.gfz.de/ns/seiscomp-schema/{schema_version}" version="{schema_version}"><Config/></seiscomp>'''
    with open(filename, 'w') as f:
        f.write(content)

def load_config() -> Config:
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    filename = os.path.join(curr_dir, '..', 'config.json')
    with open(filename, 'r') as f:
        config = Config(**json.load(f))
    write_scp_config(config.seiscomp.schema_version)
    return config

CONFIG = load_config()

def update_config(config: Config) -> None:
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    filename = os.path.join(curr_dir, '..', 'config.json')
    with open(filename, 'w') as f:
        json.dump(config.model_dump(), f, indent=2, sort_keys=True)
    global CONFIG
    CONFIG = load_config()

def fix_ids(o: Any, remove: bool = False) -> None:
    if isinstance(o, list):
        for item in o:
            fix_ids(item, remove)
    elif isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, str) and k.endswith('ID') and k != 'agencyID':
                if remove and v.startswith('smi:'):
                    o[k] = '/'.join(v.split('/')[1:])
                else:
                    if not v.startswith('smi:'):
                        o[k] = f'smi:oca/{v}'
            else:
                fix_ids(v, remove)

def jquake_to_quakeml(jquake: list[dict[str, Any]], add_prefix_id: bool = True) -> str:
    if add_prefix_id:
        fix_ids(jquake)
    qml = {
        "q:quakeml": {
            "@xmlns": "http://quakeml.org/xmlns/bed/1.2",
            "@xmlns:q": "http://quakeml.org/xmlns/quakeml/1.2",
            "eventParameters": {
                "@publicID": "smi:oca/NA",
                "event": jquake
            }
        }
    }
    return xmltodict.unparse(qml).replace(' encoding="utf-8"', '')

def quakeml_to_jquake(qml: str | bytes, remove_prefix_id: bool = True) -> list[dict[str, Any]]:
    j = xmltodict.parse(qml)
    jquake = [j['q:quakeml']['eventParameters']['event']]
    if remove_prefix_id:
        fix_ids(jquake, remove=True)
    return jquake

def sc3ml_to_quakeml(sc3ml_str: str, add_prefix_id: bool = True) -> str:
    dom = etree.fromstring(sc3ml_str)
    newdom = apply_xslt(dom, get_scml_to_qml_xslt())
    qml = etree.tostring(newdom)
    jquake = xmltodict.parse(qml)
    if add_prefix_id:
        fix_ids(jquake)
    return xmltodict.unparse(jquake)

def get_scml_to_qml_xslt() -> str:
    v = CONFIG.seiscomp.schema_version
    if float(v) < 0.14:
        return os.path.join(CONFIG.seiscomp.root, 'share', 'xml', v, f'sc3ml_{v}__quakeml_1.2.xsl')
    return os.path.join(CONFIG.seiscomp.root, 'share', 'xml', v, f'scml_{v}__quakeml_1.2.xsl')

def get_qml_to_scml_xslt() -> str:
    v = CONFIG.seiscomp.schema_version
    if float(v) < 0.14:
        return os.path.join(CONFIG.seiscomp.root, 'share', 'xml', v, f'quakeml_1.2__sc3ml_{v}.xsl')
    return os.path.join(CONFIG.seiscomp.root, 'share', 'xml', v, f'quakeml_1.2__scml_{v}.xsl')

def gen_id() -> str:
    hexa = ['%x'% x for x in range(0, 16)]
    return ''.join([hexa[randint(0, 15)] for x in range(0, 16)])

def apply_xslt(document: etree._Element | etree._ElementTree, xslt_path: str) -> etree._XSLTResultTree:
    xslt = etree.parse(xslt_path)
    transform = etree.XSLT(xslt)
    return transform(document)

def write_sc3ml(jquake: list[dict[str, Any]], filename: str) -> None:
    qml = jquake_to_quakeml(jquake, add_prefix_id=False)
    dom = etree.fromstring(qml)
    sc3ml = apply_xslt(etree.ElementTree(dom), get_qml_to_scml_xslt())
    with open(filename, 'w') as f:
        f.write(etree.tostring(sc3ml).decode('utf-8'))

def get_inventory(jquake: list[dict[str, Any]]) -> str:
    _, inv_filename = tempfile.mkstemp(suffix=".xml")
    _, sc3_inv_filename = tempfile.mkstemp(suffix=".xml")
    data = [
        'level=response',
        'format=xml'
    ]
    po = jquake[0]['origin'][0] if isinstance(jquake[0]['origin'], list) else jquake[0]['origin']
    t = po['time']['value'][0:19]
    for pick in jquake[0]['pick']:
        wfid = pick['waveformID']
        loc = wfid['@locationCode'] if '@locationCode' in wfid else '--'
        data.append(f'{wfid["@networkCode"]} {wfid["@stationCode"]} {loc} {wfid["@channelCode"]} {t} {t}')
    req_data = '\r\n'.join(data).encode('utf-8')
    r = Request('http://%s/fdsnws/station/1/query' % CONFIG.fdsnws.station_host,
                data=req_data, headers={'Content-Type': 'text/plain'})
    inv = urlopen(r).read()
    logger.debug(f'[utils.get_inventory] StationXML file: {inv_filename}')
    with open(inv_filename, 'w') as f:
        f.write(inv.decode('utf-8'))
    prog = os.path.join(CONFIG.seiscomp.root, 'bin', 'fdsnxml2inv')
    fdsnxml2inv = subprocess.Popen([prog, inv_filename], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    sc3ml, err = fdsnxml2inv.communicate()
    logger.debug(f'[utils.get_inventory] fdsnxml2inv return code: {fdsnxml2inv.returncode}')
    if fdsnxml2inv.returncode != 0:
        logger.error(f'[utils.get_inventory] fdsnxml2inv error message: {err}')
        raise ValueError(err)
    logger.debug(f'[utils.get_inventory] Sc3ML inventory file: {sc3_inv_filename}')
    with open(sc3_inv_filename, 'w') as f:
        f.write(sc3ml.decode('utf-8'))
    if not DEBUG:
        os.remove(inv_filename)
    return sc3_inv_filename

def commit_with_scdispatch(qml: bytes):
    _, sc3ml = tempfile.mkstemp(suffix=".sc3ml")
    # print(sc3ml)
    jquake = quakeml_to_jquake(qml)
    write_sc3ml(jquake, sc3ml)
    scdispatch = subprocess.Popen([
        os.path.join(CONFIG.seiscomp.root, 'bin', 'scdispatch'),
        '-H', CONFIG.seiscomp.messaging_host,
        '-O', 'merge',
        '-i', sc3ml,
        '--debug'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, error_message = scdispatch.communicate()
    os.remove(sc3ml)
    return {
        'message': error_message.decode('utf-8'),
        'return_code': scdispatch.returncode
    }

def launch_script(script_text: str, qml: bytes) -> dict[str, Any]:
    script_fd, script_filename = tempfile.mkstemp()
    with open(script_filename, 'w') as f:
        f.write(script_text)
    os.close(script_fd)
    os.chmod(script_filename, 0o755)
    _, qml_filename = tempfile.mkstemp(suffix='.xml')
    logger.debug(f'quakeml file: {qml_filename}\n')
    with open(qml_filename, 'wb') as f:
        f.write(qml)
    p = subprocess.Popen([script_filename, qml_filename],
                         stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE)
    stdout, stderr = p.communicate()
    if not DEBUG:
        os.remove(qml_filename)
    os.remove(script_filename)
    return {
        'message': f"""\
[stdout]
{stdout.decode('utf-8')}

[stderr]
{stderr.decode('utf-8')}""",
        'return_code': p.returncode
    }

def commit_script(qml: bytes) -> dict[str, Any]:
    return launch_script(CONFIG.commit_script, qml)

def get_region(lat: float, lon: float) -> str:
    return Regions.getRegionName(lat, lon)

def get_event_time(eventid: str) -> str | None:
    req = 'http://%s/fdsnws/event/1/query?format=text&eventid=%s' % (CONFIG.fdsnws.event_host, eventid)
    try:
        response = urlopen(req).read().decode('utf-8')
        for line in response.splitlines():
            if line == '' or line.startswith('#'):
                continue
            event_time = line.split('|')[1]
            return event_time
    except:
        return None

def apply_user_rules(method: str, username: str, data: Any) -> bytes | None:
    rules = CONFIG.access.users[username].rules
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
