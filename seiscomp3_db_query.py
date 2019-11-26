#!/usr/bin/python
from obspy.geodetics import FlinnEngdahl
from datetime import datetime, timedelta
import psycopg2
import re

FE = FlinnEngdahl()

class SeisComP3DBQuery():

    SCP3_DB_URI = re.compile(r'^postgresql://([a-zA-Z0-9_-]+):([a-zA-Z0-9]*)@([a-zA-Z0-9\._-]+)/([a-zA-Z0-9_-]+)$')

    RE_TIME_1 = re.compile(r'^\d{4}-\d{2}-\d{2}$')
    RE_TIME_2 = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$')
    RE_TIME_3 = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}$')
    TIME_1_FMT = '%Y-%m-%d'
    TIME_2_FMT = '%Y-%m-%dT%H:%M:%S'
    TIME_3_FMT = '%Y-%m-%dT%H:%M:%S.%f'

    INVENTORY_BASE_QUERY = '''\
        SELECT
          network.m_code AS net,
          station.m_code AS sta,
          sensorlocation.m_code AS loc,
          stream.m_code AS cha,
          sensorlocation.m_latitude,
          sensorlocation.m_longitude,
          sensorlocation.m_elevation,
          stream.m_depth,
          stream.m_azimuth,
          stream.m_dip,
          s.m_description,
          stream.m_gain,
          stream.m_gainfrequency,
          stream.m_gainunit,
          stream.m_sampleratenumerator / stream.m_sampleratedenominator AS samplerate,
          stream.m_start,
          stream.m_end
        FROM stream
        JOIN sensorlocation ON stream._parent_oid = sensorlocation._oid
        JOIN station ON sensorlocation._parent_oid = station._oid
        JOIN network ON station._parent_oid = network._oid
        JOIN (
          SELECT *
          FROM sensor
          JOIN publicobject ON sensor._oid = publicobject._oid
        ) AS s ON stream.m_sensor = s.m_publicid'''

    # event expects an event publicID
    SINGLE_EVENT_QUERY = '''\
        SELECT *
        FROM event
        JOIN publicobject ON event._oid = publicobject._oid
        WHERE m_publicid = %s'''

    MULTI_EVENT_BASE_QUERY = '''\
        SELECT e.*
        FROM (
          SELECT *
          FROM event
          JOIN publicobject ON publicobject._oid = event._oid
        ) AS e
        JOIN (
          SELECT *
          FROM origin
          JOIN publicobject ON publicobject._oid = origin._oid
        ) AS o ON e.m_preferredoriginid = o.m_publicid
        FULL JOIN (
          SELECT *
          FROM magnitude
          JOIN publicobject ON publicobject._oid = magnitude._oid
        ) AS m ON e.m_preferredmagnitudeid = m.m_publicid'''

    # origins expects an event OID
    ALL_ORIGINS_QUERY = '''\
        SELECT origin.*, publicobject.*
        FROM origin
        JOIN publicobject ON origin._oid = publicobject._oid
        JOIN originreference ON m_originid = m_publicid
        WHERE originreference._parent_oid = %s'''

    # expects an origin publicID
    PREFERRED_ORIGIN_QUERY = '''\
        SELECT *
        FROM origin
        JOIN publicobject ON origin._oid = publicobject._oid
        WHERE m_publicid = %s'''

    # arrivals expects a tuple of origin OID
    ARRIVALS_QUERY = '''\
        SELECT *
        FROM arrival
        WHERE _parent_oid IN %s'''

    # picks expects a tuple of arrival OID
    PICKS_QUERY = '''\
        SELECT *
        FROM pick
        JOIN publicobject ON pick._oid = publicobject._oid
        WHERE m_publicid IN %s'''

    # magnitudes expects a tuple of origin OID
    ALL_MAGNITUDES_QUERY = '''\
        SELECT *
        FROM magnitude
        JOIN publicobject ON magnitude._oid = publicobject._oid
        JOIN (
          SELECT m_publicid AS _originid, _oid AS o_oid
          FROM publicobject
        ) AS o ON o_oid = _parent_oid
        WHERE _parent_oid IN %s'''

    # expects a magnitude publicID
    PREFERRED_MAGNITUDE_QUERY = '''\
        SELECT *
        FROM magnitude
        JOIN publicobject ON magnitude._oid = publicobject._oid
        JOIN (
          SELECT m_publicid AS _originid, _oid AS o_oid
          FROM publicobject
        ) AS o ON o.o_oid = _parent_oid
        WHERE m_publicid = %s'''

    # expects a tuple of magnitude OID
    STATION_MAGNITUDE_CONTRIBUTION_QUERY = '''\
       SELECT *
       FROM stationmagnitudecontribution
       WHERE _parent_oid IN %s'''

    # station magnitudes expects a tuple of station_magnitude publicID
    STATION_MAGNITUDES_QUERY = '''\
        SELECT *
        FROM stationmagnitude
        JOIN publicobject ON stationmagnitude._oid = publicobject._oid
        WHERE m_publicid IN %s'''

    # amplitudes expects a tuple of amplitude publicID
    AMPLITUDES_QUERY = '''\
        SELECT *
        FROM amplitude
        JOIN publicobject ON amplitude._oid = publicobject._oid
        WHERE m_publicid IN %s'''

    def __init__(self, scp3dburi):
        (user, password, host, dbname) = SeisComP3DBQuery.SCP3_DB_URI.match(scp3dburi).groups()
        self.__user = user
        self.__password = password if password != '' else None
        self.__host = host
        self.__dbname = dbname
        self.__conn = None
        self.__cur = None

    def __enter__(self):
        self.__conn = psycopg2.connect(dbname=self.__dbname, host=self.__host, user=self.__user, password=self.__password)
        self.__cur = self.__conn.cursor()
        return self

    def __exit__(self, type, value, traceback):
        self.__cur.close()
        self.__conn.close()

    def _fetchall(self, req, attr=None):
        if self.__cur is None:
            raise ValueError('Not connected')
        self.__cur.execute(req, attr)
        cols = [x[0] for x in self.__cur.description]
        return [dict(zip(cols, x)) for x in self.__cur.fetchall()]

    def _get_time(self, s):
        if SeisComP3DBQuery.RE_TIME_1.match(s):
            return datetime.strptime(s, SeisComP3DBQuery.TIME_1_FMT)
        elif SeisComP3DBQuery.RE_TIME_2.match(s):
            return datetime.strptime(s, SeisComP3DBQuery.TIME_2_FMT)
        elif SeisComP3DBQuery.RE_TIME_3.match(s):
            return datetime.strptime(s, SeisComP3DBQuery.TIME_3_FMT)
        raise ValueError('Wrong time format')

    def _build_events_query(self, args):
        query = [SeisComP3DBQuery.MULTI_EVENT_BASE_QUERY]
        constraints = []
        params = []
        for key, value in args.iteritems():
            if key in ['starttime', 'start']:
                constraints.append('o.m_time_value >= %s')
                params.append(self._get_time(value))
            elif key in ['endtime', 'end']:
                constraints.append('o.m_time_value <= %s')
                params.append(self._get_time(value))
            elif key in ['minlatitude', 'minlat']:
                constraints.append('o.m_latitude_value >= %s')
                params.append(float(value))
            elif key in ['maxlatitude', 'maxlat']:
                constraints.append('o.m_latitude_value <= %s')
                params.append(float(value))
            elif key in ['minlongitude', 'minlon']:
                constraints.append('o.m_longitude_value >= %s')
                params.append(float(value))
            elif key in ['maxlongitude', 'maxlon']:
                constraints.append('o.m_longitude_value <= %s')
                params.append(float(value))
            elif key == 'mindepth':
                constraints.append('o.m_depth_value >= %s')
                params.append(float(value))
            elif key == 'maxdepth':
                constraints.append('o.m_depth_value <= %s')
                params.append(float(value))
            elif key in ['minmagnitude', 'minmag']:
                constraints.append('m.m_magnitude_value >= %s')
                params.append(float(value))
            elif key in ['maxmagnitude', 'maxmag']:
                constraints.append('m.m_magnitude_value <= %s')
                params.append(float(value))
        if len(constraints) > 0:
            query.append('WHERE')
            query.append('\nAND '.join(constraints))
        order = args.get('orderby', 'time')
        if order == 'time':
            query.append('ORDER BY o.m_time_value DESC')
        elif order == 'time-asc':
            query.append('ORDER BY o.m_time_value ASC')
        elif order == 'magnitude':
            query.append('ORDER BY m.m_magnitude_value DESC')
        elif order == 'magnitude-asc':
            query.append('ORDER BY m.m_magnitude_value ASC')
        if 'limit' in args:
            query.append('LIMIT %s')
            params.append(int(args['limit']))
        return '\n'.join(query), tuple(params)

    def _query_events(self, args):
        if 'eventid' in args:
            return self._fetchall(SeisComP3DBQuery.SINGLE_EVENT_QUERY, (args['eventid'],))
        return self._fetchall(*self._build_events_query(args))

    def _query_origins(self, event, args):
        origins_by_oid = {}
        po = None
        origins = []
        if args.get('includeallorigins', 'false').lower() == 'true':
            origins = self._fetchall(SeisComP3DBQuery.ALL_ORIGINS_QUERY, (event['_oid'],))
        else:
            origins = self._fetchall(SeisComP3DBQuery.PREFERRED_ORIGIN_QUERY, (event['m_preferredoriginid'],))
        for origin in origins:
            if origin['m_publicid'] == event['m_preferredoriginid']:
                po = origin
            origin['arrival'] = []
            origin['m_time_value_iso'] = (origin['m_time_value'] + timedelta(microseconds=origin['m_time_value_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            origin['m_creationinfo_creationtime_iso'] = (origin['m_creationinfo_creationtime'] + timedelta(microseconds=origin['m_creationinfo_creationtime_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            origins_by_oid[origin['_oid']] = origin
        return origins_by_oid, po

    def _query_arrivals(self, origin_oid_list):
        return self._fetchall(SeisComP3DBQuery.ARRIVALS_QUERY, (tuple(origin_oid_list),))

    def _query_picks(self, pick_id_list):
        picks = self._fetchall(SeisComP3DBQuery.PICKS_QUERY, (tuple(pick_id_list),))
        for pick in picks:
            pick['m_time_value_iso'] = (pick['m_time_value'] + timedelta(microseconds=pick['m_time_value_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            pick['m_creationinfo_creationtime_iso'] = (pick['m_creationinfo_creationtime'] + timedelta(microseconds=pick['m_creationinfo_creationtime_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
        return picks

    def _query_magnitudes(self, origin_oid_list, args, pmid):
        magnitude_by_oid = {}
        magnitudes = []
        if args.get('includeallmagnitudes', 'false').lower() == 'true':
            magnitudes = self._fetchall(SeisComP3DBQuery.ALL_MAGNITUDES_QUERY, (tuple(origin_oid_list),))
        else:
            magnitudes = self._fetchall(SeisComP3DBQuery.PREFERRED_MAGNITUDE_QUERY, (pmid,))
        for magnitude in magnitudes:
            magnitude['m_creationinfo_creationtime_iso'] = (magnitude['m_creationinfo_creationtime'] + timedelta(microseconds=magnitude['m_creationinfo_creationtime_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            magnitude['station_magnitude_contribution'] = []
            magnitude_by_oid[magnitude['_oid']] = magnitude
        return magnitude_by_oid

    def _query_station_magnitudes(self, station_magnitude_id_list, origins_by_oid):
        station_magnitudes = self._fetchall(SeisComP3DBQuery.STATION_MAGNITUDES_QUERY, (tuple(station_magnitude_id_list),))
        for station_magnitude in station_magnitudes:
            station_magnitude['m_creationinfo_creationtime_iso'] = (station_magnitude['m_creationinfo_creationtime'] + timedelta(microseconds=station_magnitude['m_creationinfo_creationtime_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            station_magnitude['m_originid'] = origins_by_oid[station_magnitude['_parent_oid']]['m_publicid']
        return station_magnitudes

    def _query_station_magnitude_contribution(self, magnitue_oid_list):
        return self._fetchall(SeisComP3DBQuery.STATION_MAGNITUDE_CONTRIBUTION_QUERY, (tuple(magnitue_oid_list),))

    def _query_amplitudes(self, amplitude_id_list):
        amplitudes = self._fetchall(SeisComP3DBQuery.AMPLITUDES_QUERY, (tuple(amplitude_id_list),))
        for amplitude in amplitudes:
            amplitude['m_timewindow_reference_iso'] = (amplitude['m_timewindow_reference'] + timedelta(microseconds=amplitude['m_timewindow_reference_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            amplitude['m_creationinfo_creationtime_iso'] = (amplitude['m_creationinfo_creationtime'] + timedelta(microseconds=amplitude['m_creationinfo_creationtime_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
        return amplitudes

    def get_events(self, args):
        events = self._query_events(args)
        for event in events:
            event['m_creationinfo_creationtime_iso'] = (event['m_creationinfo_creationtime'] + timedelta(microseconds=event['m_creationinfo_creationtime_ms'])).strftime(SeisComP3DBQuery.TIME_3_FMT)
            origins_by_oid, po = self._query_origins(event, args)
            event['origin'] = origins_by_oid.values()
            event['region'] = FE.get_region(po['m_longitude_value'], po['m_latitude_value']) if po is not None else ''
            if args.get('includearrivals', 'false').lower() == 'true':
                arrivals = self._query_arrivals(origins_by_oid.keys())
                pick_id_list = []
                for arrival in arrivals:
                    pick_id_list.append(arrival['m_pickid'])
                    origins_by_oid[arrival['_parent_oid']]['arrival'].append(arrival)
                event['pick'] = self._query_picks(pick_id_list)
            magnitudes_by_oid = self._query_magnitudes(origins_by_oid.keys(), args, event['m_preferredmagnitudeid'])
            event['magnitude'] = magnitudes_by_oid.values()
            if args.get('includestationmagnitudes', 'false').lower() == 'true':
                station_magnitude_contributions = self._query_station_magnitude_contribution([x['_oid'] for x in event['magnitude']])
                for station_magnitude_contribution in station_magnitude_contributions:
                    magnitudes_by_oid[station_magnitude_contribution['_parent_oid']]['station_magnitude_contribution'].append(station_magnitude_contribution)
                event['station_magnitude'] = self._query_station_magnitudes([x['m_stationmagnitudeid'] for x in station_magnitude_contributions], origins_by_oid)
                event['amplitude'] = self._query_amplitudes([x['m_amplitudeid'] for x in event['station_magnitude']])
            else:
                event['station_magnitude'] = []
                event['amplitude'] = []
        return events

    def get_inventory(self, channel_constraint_list):

        def format_value(val):
            if val is None:
                return ''
            if isinstance(val, datetime):
                return val.strftime(SeisComP3DBQuery.TIME_2_FMT)
            return str(val)

        inv = ['#Network|Station|Location|Channel|Latitude|Longitude|Elevation|Depth|Azimuth|Dip|SensorDescription|Scale|ScaleFreq|ScaleUnits|SampleRate|StartTime|EndTime']
        for channel_constraint in channel_constraint_list:
            params = []
            constraints = []
            query = [SeisComP3DBQuery.INVENTORY_BASE_QUERY]
            if 'network' in channel_constraint:
                constraints.append('network.m_code ~ %s')
                params.append(channel_constraint['network'].replace('?', '.').replace('*', '.*'))
            if 'station' in channel_constraint:
                constraints.append('station.m_code ~ %s')
                params.append(channel_constraint['station'].replace('?', '.').replace('*', '.*'))
            if 'location' in channel_constraint:
                constraints.append('sensorlocation.m_code ~ %s')
                params.append(channel_constraint['location'].replace('?', '.').replace('*', '.*'))
            if 'channel' in channel_constraint:
                constraints.append('stream.m_code ~ %s')
                params.append(channel_constraint['channel'].replace('?', '.').replace('*', '.*'))
            if 'starttime' in channel_constraint:
                constraints.append('stream.m_start <= %s')
                params.append(self._get_time(channel_constraint['starttime']))
            if 'endtime' in channel_constraint:
                constraints.append('(stream.m_end >= %s OR stream.m_end IS NULL)')
                params.append(self._get_time(channel_constraint['endtime']))
            if len(constraints) > 0:
                query.append('WHERE')
                query.append('\nAND '.join(constraints))
            self.__cur.execute('\n'.join(query), tuple(params))
            channels = self.__cur.fetchall()
            inv.extend(['|'.join([format_value(val) for val in x]) for x in channels])
        return '\n'.join(inv)


if __name__ == '__main__':
    import json
    with SeisComP3DBQuery('postgresql://sc3reader:@babel.unice.fr/seiscomp3_dev') as scp3dbquery:
        event = scp3dbquery.get_events({
            'eventid': 'oca2019wcnn',
            #'start': '2019-11-13',
            #'minlat': '41',
            #'maxlat': '45',
            #'minlon': '4',
            #'maxlon': '10'
            'includeallorigins': 'true',
            'includeallmagnitudes': 'true',
            'includearrivals': 'true',
            'includestationmagnitudes': 'true'
        })
        print(json.dumps(event, indent=2, default=str, sort_keys=True))

        '''
        inv = scp3dbquery.get_inventory([
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '01',
           'network': 'FR',
           'starttime': '2019-11-11T10:52:46',
           'station': 'ESCA'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '00',
           'network': 'FR',
           'starttime': '2019-11-11T10:52:46',
           'station': 'OGSI'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '',
           'network': 'GE',
           'starttime': '2019-11-11T10:52:46',
           'station': 'STU'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '',
           'network': 'GE',
           'starttime': '2019-11-11T10:52:46',
           'station': 'WLF'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '',
           'network': 'CA',
           'starttime': '2019-11-11T10:52:46',
           'station': 'CMAS'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '00',
           'network': 'FR',
           'starttime': '2019-11-11T10:52:46',
           'station': 'LEMB'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '00',
           'network': 'FR',
           'starttime': '2019-11-11T10:52:46',
           'station': 'VOEL'},
          {'channel': '*',
           'endtime': '2019-11-11T10:52:46',
           'location': '00',
           'network': 'FR',
           'starttime': '2019-11-11T10:52:46',
           'station': 'CIEL'}
        ])
        print(inv)
        '''
