from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends, status
from app.model import WSDetectorArgs, WSDenoiserArgs, TTTQuery, TakeoffAngleQuery, Activity
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from typing import Annotated, Literal
from app import processing
from app import utils
import urllib.request
import urllib.parse
import secrets
import json


class ConnectionManager:
    def __init__(self):
        self.connection_mapping: dict[WebSocket, Activity] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    async def update_activity(self, websocket: WebSocket, activity: Activity):
        self.connection_mapping[websocket] = activity
        await self.broadcast_activity()

    def disconnect(self, websocket: WebSocket):
        del self.connection_mapping[websocket]

    async def broadcast_activity(self):
        activity_list: list[Activity] = [x.model_dump() for x in self.connection_mapping.values()]
        for websocket in self.connection_mapping.keys():
            await websocket.send_json(activity_list)


manager = ConnectionManager()


app = FastAPI(title='WebPicker')

security = HTTPBasic()


def check_credentials(credentials: Annotated[HTTPBasicCredentials, Depends(security)]):
    username = credentials.username.encode('utf8')
    password = credentials.password.encode('utf8')
    for user, user_data in utils.CONFIG.access.users.items():
        current_username = user.encode('utf-8')
        current_password = user_data.password.encode('utf-8')
        if(secrets.compare_digest(username, current_username)
            and secrets.compare_digest(password, current_password)):
            return credentials.username
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Incorrect username or password',
        headers={'WWWW-Authenticate': 'Basic'}
    )

def no_authentication():
    return ''

check_authentication = check_credentials if utils.CONFIG.access.restricted is True else no_authentication

app.mount("/static", StaticFiles(directory="dist/static"), name="static")

@app.get('/', response_class=FileResponse)
@app.get('/{o}', response_class=FileResponse)
@app.get('/event/{o}', response_class=FileResponse)
def index(username: Annotated[str, Depends(check_authentication)], o=None):
    return FileResponse('dist/index.html')

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            activity = Activity(**data)
            await manager.update_activity(websocket, activity)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_activity()

@app.get('/api/detector', tags=['api'])
def get_detector_picks(wfid: str, model: str, start: str, end: str, p_thresh: float, s_thresh: float, username: Annotated[str, Depends(check_authentication)]):
    net, sta, loc, cha = wfid.split('.')
    req_args = WSDetectorArgs(
        network=net, station=sta, location=loc if loc != '' else '--', channel=cha,
        starttime=start, endtime=end, p_threshold=p_thresh, s_threshold=s_thresh,
        url=f'http://{utils.CONFIG.fdsnws.dataselect_host}',
        get_probability=False
    )
    # print(req_args.model_dump_json())
    req = urllib.request.Request(utils.CONFIG.detector.url.replace('<model>', model),
                                 data=req_args.model_dump_json().encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    return Response(content=urllib.request.urlopen(req).read(), media_type='application/json')

@app.get('/api/denoiser', tags=['api'])
def get_denoised_waveforms(network: str, station: str, location: str, channel: str, starttime: str, endtime: str, username: Annotated[str, Depends(check_authentication)]):
    req_args = WSDenoiserArgs(
        network=network, station=station, location=location, channel=channel,
        starttime=starttime, endtime=endtime, url=f'http://{utils.CONFIG.fdsnws.dataselect_host}'
    )
    req = urllib.request.Request(utils.CONFIG.denoiser.url,
                                 data=req_args.model_dump_json().encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    response = urllib.request.urlopen(req)
    return Response(content=response.read(), media_type=response.headers.get_content_type())

@app.post('/api/ttt', tags=['api'])
def get_ttt(args: TTTQuery, username: Annotated[str, Depends(check_authentication)]):
    result = {}
    for netsta, pos in args.station.items():
        try:
            result[netsta] = {'ttt': processing.get_locsat_travel_times(
                args.latitude, args.longitude, args.depth, pos[0], pos[1], pos[2]
            )}
        except:
            result[netsta] = {'ttt': {'P': 0, 'S': 0}}
    nll_ttt_data = args.model_dump_json().encode('utf-8')
    nll_ttt_req = urllib.request.Request(
        f'{utils.CONFIG.nll.url}/ttt/{utils.CONFIG.nll.area}/iasp91/',
        data=nll_ttt_data,
        headers={'Content-Type': 'application/json'}
    )
    nll_ttt = json.load(urllib.request.urlopen(nll_ttt_req))
    for netsta, ttt in nll_ttt.items():
        if netsta not in result:
            result[netsta] = {}
        result[netsta]['nll_ttt'] = ttt['ttt']
    return result

@app.post('/api/takeoffangle', tags=['api'])
def get_takeoffangle(args: TakeoffAngleQuery, username: Annotated[str, Depends(check_authentication)]):
    result = {}
    for sta, distance in args.station.items():
        result[sta] = processing.takeoffangle(args.depth, distance)
    return result

@app.get('/api/region', tags=['api'])
def get_region_name(longitude: float, latitude: float, username: Annotated[str, Depends(check_authentication)]):
    return utils.get_region(longitude, latitude)

@app.post('/api/compute_magnitudes', tags=['api'])
async def compute_magnitudes(request: Request, username: Annotated[str, Depends(check_authentication)]):
    jquake = await request.json()
    return processing.compute_magnitudes_with_scamp_and_scmag(jquake)

@app.post('/api/relocate', tags=['api'])
async def relocate(locator: Literal['LOCSAT', 'NonLinLoc'], profile: str, request: Request, username: Annotated[str, Depends(check_authentication)]):
    jquake = await request.json()
    if locator == 'LOCSAT':
        # result = relocate_with_screloc(jquake, profile)
        result = processing.relocate_with_scp_api(jquake, profile)
    elif locator == 'NonLinLoc':
        result = processing.relocate_with_nll(jquake, profile)
    return result

@app.post('/api/commit', tags=['api'])
async def commit(request: Request, username: Annotated[str, Depends(check_authentication)]):
    jquake = await request.json()
    result = utils.commit_with_scdispatch(jquake)
    return result

@app.get('/fdsnws/event/1/query', tags=['fdsnws'])
def get_events(request: Request, username: Annotated[str, Depends(check_authentication)]):
    query = dict(request.query_params)
    if utils.CONFIG.access.restricted:
        utils.apply_user_rules('GET', username, query)
    req = f'http://{utils.CONFIG.fdsnws.event_host}/fdsnws/event/1/query?{urllib.parse.urlencode(query)}'
    response = urllib.request.urlopen(req)
    return Response(content=response.read(), media_type=response.headers.get_content_type())

@app.get('/fdsnws/station/1/query', tags=['fdsnws'])
def get_stations(request: Request, username: Annotated[str, Depends(check_authentication)]):
    req = f'http://{utils.CONFIG.fdsnws.station_host}/fdsnws/station/1/query?{request.query_params}'
    response = urllib.request.urlopen(req)
    return Response(content=response.read(), media_type=response.headers.get_content_type())

@app.post('/fdsnws/station/1/query', tags=['fdsnws'])
async def post_stations(request: Request, username: Annotated[str, Depends(check_authentication)]):
    data = await request.body()
    req = urllib.request.Request(
        f'http://{utils.CONFIG.fdsnws.station_host}/fdsnws/station/1/query',
        data=data, headers={'Content-Type': request.headers['Content-Type']}
    )
    response = urllib.request.urlopen(req)
    return Response(content=response.read(), media_type=response.headers.get_content_type())

@app.get('/fdsnws/dataselect/1/query', tags=['fdsnws'])
def get_dataselect(request: Request, username: Annotated[str, Depends(check_authentication)]):
    query = dict([x.split('=') for x in request.query_params.split('&')])
    if utils.CONFIG.access.restricted:
        utils.apply_user_rules('GET', username, query)
    req = f'http://{utils.CONFIG.fdsnws.dataselect_host}/fdsnws/dataselect/1/query?{urllib.parse.urlencode(query)}'
    response = urllib.request.urlopen(req)
    return Response(content=response.read(), media_type=response.headers.get_content_type())

@app.post('/fdsnws/dataselect/1/query', tags=['fdsnws'])
async def post_dataselect(request: Request, username: Annotated[str, Depends(check_authentication)]):
    data = await request.body()
    if utils.CONFIG.access.restricted:
        data = utils.apply_user_rules('POST', username, data)
        if data is None:
            return Response(content='', media_type='application/vnd.fdsn.mseed')
    req = urllib.request.Request(
        f'http://{utils.CONFIG.fdsnws.dataselect_host}/fdsnws/dataselect/1/query',
        data=data, headers={'Content-Type': request.headers['Content-Type']}
    )
    response = urllib.request.urlopen(req)
    return Response(content=response.read(), media_type=response.headers.get_content_type())
