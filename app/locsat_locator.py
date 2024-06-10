import traceback
from obspy import UTCDateTime
from seiscomp.core import Time
from urllib.request import urlopen, Request
from seiscomp.datamodel import Pick, CreationInfo, WaveformStreamID, Phase, \
    Arrival, Origin, TimeQuantity, RealQuantity, Inventory, Network, Station, \
    SensorLocation, AUTOMATIC, MANUAL
from seiscomp.seismology import LocatorInterface, TravelTimeTableInterface
from obspy.geodetics.base import gps2dist_azimuth, kilometers2degrees

def to_scp_time(t):
    return Time.FromString(f'{t:0<26}', '%Y-%m-%dT%H:%M:%S.%f')

def to_scp_pick(j_pick):
    scp_pick = Pick(j_pick['@publicID'])
    creation_info = CreationInfo()
    creation_info.setCreationTime(to_scp_time(j_pick["creationInfo"]["creationTime"]))
    creation_info.setAgencyID(j_pick["creationInfo"]["agencyID"])
    creation_info.setAuthor(j_pick["creationInfo"]["author"])
    scp_pick.setCreationInfo(creation_info)
    scp_pick.setTime(TimeQuantity(to_scp_time(j_pick["time"]["value"])))
    scp_pick.setEvaluationMode(AUTOMATIC if j_pick['evaluationMode'] == 'automatic' else MANUAL)
    scp_pick.setPhaseHint(Phase(j_pick['phaseHint']))
    if 'filter_id' in j_pick:
        scp_pick.setFilterID(j_pick['filterID'])
    wfid = j_pick['waveformID']
    scp_pick.setWaveformID(WaveformStreamID(wfid['@networkCode'], wfid['@stationCode'], wfid.get('@locationCode', ''), wfid['@channelCode'], ''))
    return scp_pick

def to_scp_arrival(j_arrival):
    scp_arrival = Arrival()
    scp_arrival.setPickID(j_arrival['pickID'])
    scp_arrival.setPhase(Phase(j_arrival['phase']))
    if 'azimuth' in j_arrival:
        scp_arrival.setAzimuth(j_arrival['azimuth'])
    if 'distance' in j_arrival:
        scp_arrival.setDistance(j_arrival['distance'])
    if 'time_residual' in j_arrival:
        scp_arrival.setTimeResidual(j_arrival['timeResidual'])
    scp_arrival.setWeight(j_arrival['timeWeight'])
    scp_arrival.setTimeUsed(True)
    return scp_arrival

def to_scp_origin(j_origin):
    scp_origin: Origin = Origin.Create(j_origin['@publicID'])
    scp_origin.setTime(TimeQuantity(to_scp_time(j_origin["time"]["value"])))
    scp_origin.setLatitude(RealQuantity(j_origin['latitude']['value'], j_origin['latitude']['uncertainty']))
    scp_origin.setLongitude(RealQuantity(j_origin['longitude']['value'], j_origin['longitude']['uncertainty']))
    scp_origin.setDepth(RealQuantity(j_origin['depth']['value'], j_origin['depth'].get('uncertainty')))
    for j_arrival in j_origin['arrival']:
        if j_arrival['timeWeight'] > 0:
            scp_origin.add(to_scp_arrival(j_arrival))
        scp_origin.add(to_scp_arrival(j_arrival))
    return scp_origin

def get_inventory(fdsnws_host, pick_map):
    req_data = [
        'format=text',
        'level=channel'
    ]
    for _, j_pick in pick_map.items():
        wfid = j_pick['waveformID']
        t = j_pick['time']['value'][:19]
        req_data.append('%s %s %s %s %s %s' % (wfid["@networkCode"], wfid["@stationCode"], wfid.get("@locationCode", "--"), wfid["@channelCode"], t, t))
    r = Request('http://%s/fdsnws/station/1/query' % fdsnws_host, data='\r\n'.join(req_data).encode('utf-8'), headers={'Content-Type': 'text/plain'})
    resp = urlopen(r).read().decode('utf-8')
    scp_inv = Inventory()
    inv_struct = {}
    for line in resp.splitlines():
        if line == '' or line.startswith('#'):
            continue
        net, sta, loc, _, lat, lon, alt = line.split('|')[:7]
        start, end = line.split('|')[-2:]
        if net not in inv_struct:
            scp_net: Network = Network.Create()
            scp_net.setCode(net)
            inv_struct[net] = {'obj': scp_net, 'station': {}}
            scp_inv.add(scp_net)
        if sta not in inv_struct[net]['station']:
            scp_sta: Station = Station.Create()
            scp_sta.setCode(sta)
            inv_struct[net]['station'][sta] = {'obj': scp_sta, 'location': {}}
            inv_struct[net]['obj'].add(scp_sta)
        if loc not in inv_struct[net]['station'][sta]['location']:
            scp_sl: SensorLocation = SensorLocation.Create()
            if loc != '':
                scp_sl.setCode(loc)
            scp_sl.setLatitude(float(lat))
            scp_sl.setLongitude(float(lon))
            scp_sl.setElevation(float(alt))
            scp_sl.setStart(Time.FromString(start[:19], '%Y-%m-%dT%H:%M:%S'))
            if end != '':
                scp_sl.setEnd(Time.FromString(end[:19], '%Y-%m-%dT%H:%M:%S'))
            inv_struct[net]['station'][sta]['location'][loc] = {'obj': scp_sl, 'channel': {}}
            inv_struct[net]['station'][sta]['obj'].add(scp_sl)
    scp_inv.setPublicID('Inventory')
    scp_inv.registerMe()
    # print(inv_struct)
    return scp_inv

def to_jquake(scp_origin: Origin):
    j_origin = {
        '@publicID': scp_origin.publicID(),
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
        'methodID': scp_origin.methodID(),
        'earthModelID': scp_origin.earthModelID(),
        'quality': {
            'associatedPhaseCount': scp_origin.quality().associatedPhaseCount(),
            'usedPhaseCount': scp_origin.quality().usedPhaseCount(),
            'associatedStationCount': scp_origin.quality().associatedStationCount(),
            'usedStationCount': scp_origin.quality().usedStationCount(),
            'standardError': scp_origin.quality().standardError(),
            'azimuthalGap': scp_origin.quality().azimuthalGap(),
            'minimumDistance': scp_origin.quality().minimumDistance(),
            'maximumDistance': scp_origin.quality().maximumDistance(),
            'medianDistance': scp_origin.quality().medianDistance(),
        },
        # 'evaluation_mode': 'manual' if scp_origin.evaluationMode() == MANUAL else 'automatic',
        'evaluationMode': 'manual',
        'creationInfo': {
            'agencyID': 'OCA',
            'author': 'webpicker',
            'creationTime': scp_origin.creationInfo().creationTime().toString('%Y-%m-%dT%H:%M:%S.%fZ')
        },
        'arrival': list()
    }
    for a_i in range(scp_origin.arrivalCount()):
        scp_arrival: Arrival = scp_origin.arrival(a_i)
        j_origin['arrival'].append({
            'pickID': scp_arrival.pickID(),
            'phase': scp_arrival.phase().code(),
            'azimuth': scp_arrival.azimuth(),
            'distance': scp_arrival.distance(),
            'timeResidual': scp_arrival.timeResidual(),
            'timeWeight': scp_arrival.weight()
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
    pick_map = {}
    pick_list = list()
    keep_arrival = list()
    save_arrival = jquake[0]['origin'][0]['arrival']
    not_used_arrival = list()
    for j_pick in jquake[0]['pick']:
        pick_map[j_pick['@publicID']] = j_pick
        scp_pick = to_scp_pick(j_pick)
        scp_pick.registerMe()
        pick_list.append(scp_pick)
    for j_arrival in jquake[0]['origin'][0]['arrival']:
        if j_arrival['timeWeight'] > 0:
            keep_arrival.append(j_arrival)
        else:
            not_used_arrival.append(j_arrival)
    jquake[0]['origin'][0]['arrival'] = keep_arrival
    scp_inv = get_inventory(fdsnws_host, pick_map)
    pick_list.sort(key=lambda x: x.time().value().iso())
    locator: LocatorInterface = LocatorInterface.Create('LOCSAT')
    locator.useFixedDepth(False)
    locator.setProfile(profile)
    # print([(x.waveformID().stationCode(), x.time().value().iso()) for x in pick_list])
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
        new_scp_origin = locator.relocate(scp_origin)
        new_origin = to_jquake(new_scp_origin)
        ot = UTCDateTime.strptime(new_origin['time']['value'], '%Y-%m-%dT%H:%M:%S.%fZ')
        for j_arrival in not_used_arrival:
            scp_pick: Pick = Pick.Find(j_arrival['pickID'])
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
        pick_station_map = {}
        for pick in jquake[0]['pick']:
            net_sta = '%s.%s' % (pick['waveformID']['@networkCode'], pick['waveformID']['@stationCode'])
            pick_station_map[pick['@publicID']] = net_sta
        new_origin['quality']['associatedPhaseCount'] = len(new_origin['arrival'])
        new_origin['quality']['associatedStationCount'] = len(set([pick_station_map[a['pickID']] for a in new_origin['arrival']]))
        jquake[0]['origin'] = [new_origin]
        jquake[0]['preferredOriginID'] = new_origin['@publicID']
        new_scp_origin.deregisterMe()
        return '', jquake
    except Exception as exception:
        jquake[0]['origin'][0]['arrival'] = save_arrival
        error_msg = traceback.format_exc()
        print(error_msg)
        return error_msg, None


if __name__ == '__main__':
    import json
    with open('reloc_test.json') as f:
        jquake = json.load(f)
    error, result = relocate(jquake, 'iasp91', 'encelade.unice.fr:8080')
    if result is None:
        print(error)
    else:
        print(json.dumps(result, indent=2))

