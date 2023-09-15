import traceback
from obspy import UTCDateTime
from seiscomp.core import Time
from urllib.request import urlopen, Request
from seiscomp.datamodel import Pick, CreationInfo, WaveformStreamID, Phase, \
    Arrival, Origin, TimeQuantity, RealQuantity, Inventory, Network, Station, \
    SensorLocation, AUTOMATIC, MANUAL
from seiscomp.seismology import LocatorInterface, TravelTimeTableInterface
from obspy.geodetics.base import gps2dist_azimuth, kilometers2degrees


def to_scp_pick(j_pick):
    scp_pick = Pick(j_pick['public_id'])
    creation_info = CreationInfo()
    creation_info.setCreationTime(Time.FromString('%s000' % j_pick["creation_info"]["creation_time"], '%Y-%m-%dT%H:%M:%S.%f'))
    creation_info.setAgencyID(j_pick["creation_info"]["agency_id"])
    creation_info.setAuthor(j_pick["creation_info"]["author"])
    scp_pick.setCreationInfo(creation_info)
    scp_pick.setTime(TimeQuantity(Time.FromString('%s000' % j_pick["time"]["value"], '%Y-%m-%dT%H:%M:%S.%f')))
    scp_pick.setEvaluationMode(AUTOMATIC if j_pick['evaluation_mode'] == 'automatic' else MANUAL)
    scp_pick.setPhaseHint(Phase(j_pick['phase_hint']))
    if 'filter_id' in j_pick:
        scp_pick.setFilterID(j_pick['filter_id'])
    wfid = j_pick['waveform_id']
    scp_pick.setWaveformID(WaveformStreamID(wfid['network_code'], wfid['station_code'], wfid.get('location_code', ''), wfid['channel_code'], ''))
    return scp_pick

def to_scp_arrival(j_arrival):
    scp_arrival = Arrival()
    scp_arrival.setPickID(j_arrival['pick_id'])
    scp_arrival.setPhase(Phase(j_arrival['phase']))
    scp_arrival.setAzimuth(j_arrival['azimuth'])
    scp_arrival.setDistance(j_arrival['distance'])
    scp_arrival.setTimeResidual(j_arrival['time_residual'])
    scp_arrival.setWeight(j_arrival['time_weight'])
    scp_arrival.setTimeUsed(True)
    return scp_arrival

def to_scp_origin(j_origin):
    scp_origin: Origin = Origin.Create(j_origin['public_id'])
    scp_origin.setTime(TimeQuantity(Time.FromString('%s000' % j_origin["time"]["value"], '%Y-%m-%dT%H:%M:%S.%f')))
    scp_origin.setLatitude(RealQuantity(j_origin['latitude']['value'], j_origin['latitude']['uncertainty']))
    scp_origin.setLongitude(RealQuantity(j_origin['longitude']['value'], j_origin['longitude']['uncertainty']))
    scp_origin.setDepth(RealQuantity(j_origin['depth']['value'], j_origin['depth'].get('uncertainty')))
    for j_arrival in j_origin['arrival']:
        if j_arrival['time_weight'] > 0:
            scp_origin.add(to_scp_arrival(j_arrival))
        scp_origin.add(to_scp_arrival(j_arrival))
    return scp_origin

def get_inventory(fdsnws_host, pick_map):
    req_data = [
        'format=text',
        'level=channel'
    ]
    for _, j_pick in pick_map.items():
        wfid = j_pick['waveform_id']
        t = j_pick['time']['value'][:19]
        req_data.append('%s %s %s %s %s %s' % (wfid["network_code"], wfid["station_code"], wfid.get("location_code", "--"), wfid["channel_code"], t, t))
    r = Request('http://%s/fdsnws/station/1/query' % fdsnws_host, data='\r\n'.join(req_data).encode('utf-8'), headers={'Content-Type': 'text/plain'})
    resp = urlopen(r).read().decode('utf-8')
    scp_inv = Inventory()
    inv_struct = dict()
    for line in resp.splitlines():
        if line == '' or line.startswith('#'):
            continue
        net, sta, loc, _, lat, lon, alt = line.split('|')[:7]
        start, end = line.split('|')[-2:]
        if net not in inv_struct:
            scp_net: Network = Network.Create()
            scp_net.setCode(net)
            inv_struct[net] = {'obj': scp_net, 'station': dict()}
            scp_inv.add(scp_net)
        if sta not in inv_struct[net]['station']:
            scp_sta: Station = Station.Create()
            scp_sta.setCode(sta)
            inv_struct[net]['station'][sta] = {'obj': scp_sta, 'location': dict()}
            inv_struct[net]['obj'].add(scp_sta)
        if loc not in inv_struct[net]['station'][sta]['location']:
            scp_sl: SensorLocation = SensorLocation.Create()
            scp_sl.setCode(loc)
            scp_sl.setLatitude(float(lat))
            scp_sl.setLongitude(float(lon))
            scp_sl.setElevation(float(alt))
            scp_sl.setStart(Time.FromString(start[:19], '%Y-%m-%dT%H:%M:%S'))
            if end != '':
                scp_sl.setEnd(Time.FromString(end[:19], '%Y-%m-%dT%H:%M:%S'))
            inv_struct[net]['station'][sta]['location'][loc] = {'obj': scp_sl, 'channel': dict()}
            inv_struct[net]['station'][sta]['obj'].add(scp_sl)
    scp_inv.setPublicID('Inventory')
    scp_inv.registerMe()
    return scp_inv

def to_jquake(scp_origin: Origin):
    j_origin = {
        'public_id': 'smi:oca/1.0/%s' % scp_origin.publicID(),
        'time': {
            'value': scp_origin.time().value().toString('%Y-%m-%dT%H:%M:%S.%fZ'),
            'uncertainty': scp_origin.time().uncertainty()
        },
        'latitude': {
            'value': scp_origin.latitude().value(),
            'uncertainty': scp_origin.latitude().uncertainty()
        },
        'longitude': {
            'value': scp_origin.longitude().value(),
            'uncertainty': scp_origin.longitude().uncertainty()
        },
        'depth': {
            'value': scp_origin.depth().value() * 1000,
            'uncertainty': scp_origin.depth().uncertainty() * 1000
        },
        'method_id': 'smi:oca/1.0/%s' % scp_origin.methodID(),
        'earth_model_id': 'smi:oca/1.0/%s' % scp_origin.earthModelID(),
        'quality': {
            'associated_phase_count': scp_origin.quality().associatedPhaseCount(),
            'used_phase_count': scp_origin.quality().usedPhaseCount(),
            'associated_station_count': scp_origin.quality().associatedStationCount(),
            'used_station_count': scp_origin.quality().usedStationCount(),
            'standard_error': scp_origin.quality().standardError(),
            'azimuthal_gap': scp_origin.quality().azimuthalGap(),
            'minimum_distance': scp_origin.quality().minimumDistance(),
            'maximum_distance': scp_origin.quality().maximumDistance(),
            'median_distance': scp_origin.quality().medianDistance(),
        },
        # 'evaluation_mode': 'manual' if scp_origin.evaluationMode() == MANUAL else 'automatic',
        'evaluation_mode': 'manual',
        'creation_info': {
            'agency_id': 'OCA',
            'author': 'webpicker',
            'creation_time': scp_origin.creationInfo().creationTime().toString('%Y-%m-%dT%H:%M:%S.%fZ')
        },
        'arrival': list()
    }
    for a_i in range(scp_origin.arrivalCount()):
        scp_arrival: Arrival = scp_origin.arrival(a_i)
        j_origin['arrival'].append({
            'pick_id': scp_arrival.pickID(),
            'phase': scp_arrival.phase().code(),
            'azimuth': scp_arrival.azimuth(),
            'distance': scp_arrival.distance(),
            'time_residual': scp_arrival.timeResidual(),
            'time_weight': scp_arrival.weight()
        })
    return j_origin

# def print_inventory(scp_inv: Inventory):
#     for i_n in range(scp_inv.networkCount()):
#         scp_net: Network = scp_inv.network(i_n)
#         for i_s in range(scp_net.stationCount()):
#             scp_sta: Station = scp_net.station(i_s)
#             for i_sl in range(scp_sta.sensorLocationCount()):
#                 scp_sl: SensorLocation = scp_sta.sensorLocation(i_sl)
#                 end = None
#                 try:
#                     end = scp_sl.end()
#                 except:
#                     pass
#                 print(f'{scp_net.code()}.{scp_sta.code()}.{scp_sl.code()} {scp_sl.start()} -> {end}')

def relocate(jquake, profile, fdsnws_host):
    t = jquake[0]['origin'][0]['time']['value'][0:19]
    pick_map = dict()
    pick_list = list()
    keep_arrival = list()
    not_used_arrival = list()
    for j_pick in jquake[0]['pick']:
        pick_map[j_pick['public_id']] = j_pick
        scp_pick = to_scp_pick(j_pick)
        scp_pick.registerMe()
        pick_list.append(scp_pick)
    for j_arrival in jquake[0]['origin'][0]['arrival']:
        if j_arrival['time_weight'] > 0:
            keep_arrival.append(j_arrival)
        else:
            not_used_arrival.append(j_arrival)
    jquake[0]['origin'][0]['arrival'] = keep_arrival
    scp_inv = get_inventory(fdsnws_host, pick_map)
    pick_list.sort(key=lambda x: x.time().value())
    locator: LocatorInterface = LocatorInterface.Create('LOCSAT')
    locator.useFixedDepth(False)
    locator.setProfile(profile)
    sloc = locator.getSensorLocation(pick_list[0])
    scp_origin = to_scp_origin(jquake[0]['origin'][0])
    scp_origin.setTime(pick_list[0].time())
    scp_origin.setLatitude(RealQuantity(sloc.latitude()))
    scp_origin.setLongitude(RealQuantity(sloc.longitude()))
    scp_origin.setDepth(RealQuantity(11.0))
    # locator.setParameter('VERBOSE', 'y')
    ttti: TravelTimeTableInterface = TravelTimeTableInterface.Create('LOCSAT')
    ttti.setModel(profile)
    try:
        new_origin = to_jquake(locator.relocate(scp_origin))
        ot = UTCDateTime.strptime(new_origin['time']['value'], '%Y-%m-%dT%H:%M:%S.%fZ')
        for j_arrival in not_used_arrival:
            scp_pick: Pick = Pick.Find(j_arrival['pick_id'])
            p_time = UTCDateTime.strptime(scp_pick.time().value().toString('%Y-%m-%dT%H:%M:%S.%fZ'), '%Y-%m-%dT%H:%M:%S.%fZ')
            sloc: SensorLocation = locator.getSensorLocation(scp_pick)
            distance, azimuth, _ = gps2dist_azimuth(
                new_origin['latitude']['value'],
                new_origin['longitude']['value'],
                sloc.latitude(),
                sloc.longitude()
            )
            j_arrival['distance'] = kilometers2degrees(distance / 1e3)
            j_arrival['azimuth'] = azimuth
            t_time: UTCDateTime = ot + ttti.compute(
                j_arrival['phase'],
                new_origin['latitude']['value'],
                new_origin['longitude']['value'],
                new_origin['depth']['value'] / 1e3,
                sloc.latitude(),
                sloc.longitude(),
                sloc.elevation()
            ).time
            j_arrival['time_residual'] = p_time - t_time
            new_origin['arrival'].append(j_arrival)
        new_origin['quality']['associated_phase_count'] = jquake[0]['origin'][0]['quality']['associated_phase_count']
        new_origin['quality']['associated_station_count'] = jquake[0]['origin'][0]['quality']['associated_station_count']
        jquake[0]['origin'] = [new_origin]
        jquake[0]['preferred_origin_id'] = new_origin['public_id']
        return '', jquake
    except Exception as exception:
        print(traceback.format_exc())
        return str(exception), None


if __name__ == '__main__':
    import json
    with open('reloc_test.json') as f:
        jquake = json.load(f)
    error, result = relocate(jquake, 'iasp91', 'encelade.unice.fr:8080')
    if result is None:
        print(error)
    else:
        print(json.dumps(result, indent=2))