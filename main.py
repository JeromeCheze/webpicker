import os
import sys
sys.path.insert(0, os.path.join(os.environ['SEISCOMP_ROOT'], 'lib', 'python'))
import json
import typing
import secrets
import hashlib
import urllib.parse
import urllib.request
from app import utils
from app import processing
from typing import Annotated, Literal
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends, status
from app.model import WSActivityResponse, WSChatResponse, WSDetectorArgs, WSDenoiserArgs, TTTQuery, ActivityData, WSUpdateEventResponse, WSVersionResponse, ChatData

ADMIN_PASSWORD = '94da2becb9d86711399f6054e8ea6382'

class ConnectionManager:
    def __init__(self):
        self.connection_mapping: dict[WebSocket, ActivityData] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        with open('src/version.json') as f:
            version = json.load(f)
            await websocket.send_json(WSVersionResponse(data=version).model_dump())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.connection_mapping:
            del self.connection_mapping[websocket]

    async def broadcast_message(self, msg: typing.Any):
        for websocket in list(self.connection_mapping.keys()):
            try:
                await websocket.send_json(msg)
            except Exception:
                self.disconnect(websocket)

    async def broadcast_activity(self):
        response = WSActivityResponse(data=[x for x in self.connection_mapping.values()]).model_dump()
        await self.broadcast_message(response)

    async def update_activity(self, websocket: WebSocket, activity: ActivityData):
        self.connection_mapping[websocket] = activity
        await self.broadcast_activity()

    async def broadcast_chat_msg(self, data: ChatData):
        response = WSChatResponse(data=data).model_dump()
        await self.broadcast_message(response)

    async def send_chat_msg(self, data: ChatData):
        response = WSChatResponse(data=data).model_dump()
        for websocket, activity in self.connection_mapping.items():
            if activity.id == data.recipient:
                await websocket.send_json(response)
                break


manager = ConnectionManager()
app = FastAPI(title='WebPicker')
security = HTTPBasic()


def check_credentials(credentials: Annotated[HTTPBasicCredentials, Depends(security)]):
    username = credentials.username.encode('utf8')
    password = hashlib.md5(credentials.password.encode('utf8')).hexdigest().encode('utf8')
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
            if data['type'] == 'activity':
                await manager.update_activity(websocket, ActivityData(**data['data']))
            elif data['type'] == 'updateEvent':
                eventid = data['data']
                await manager.broadcast_message(WSUpdateEventResponse(data=eventid).model_dump())
            elif data['type'] == 'chat':
                chat_data = ChatData(**data['data'])
                if chat_data.broadcast:
                    await manager.broadcast_chat_msg(chat_data)
                else:
                    await manager.send_chat_msg(chat_data)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_activity()

@app.get('/app/config', tags=['app'])
def get_app_config(username: Annotated[str, Depends(check_authentication)]):
    return utils.CONFIG

@app.post('/app/config', tags=['app'])
async def set_app_config(password: str, request: Request, username: Annotated[str, Depends(check_authentication)]):
    if secrets.compare_digest(password, ADMIN_PASSWORD):
        config = await request.json()
        utils.update_config(config)
        return 'ok'
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect username or password',
            headers={'WWWW-Authenticate': 'Basic'}
        )
        
@app.get('/api/detector', tags=['api'])
def get_detector_picks(wfid: str, model: str, start: str, end: str, p_thresh: float, s_thresh: float, dataset: str, username: Annotated[str, Depends(check_authentication)]):
    net, sta, loc, cha = wfid.split('.')
    req_args = WSDetectorArgs(
        network=net, station=sta, location=loc if loc != '' else '--', channel=cha,
        starttime=start, endtime=end, p_threshold=p_thresh, s_threshold=s_thresh,
        url=f'http://{utils.CONFIG.fdsnws.dataselect_host}',
        model=model, dataset=dataset,
        get_probability=False
    )
    # print(req_args.model_dump_json())
    req = urllib.request.Request(utils.CONFIG.detector.url,
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
    result = processing.get_locsat_travel_times(args)
    if utils.CONFIG.nll.enabled:
        nll_ttt_data = args.model_dump_json().encode('utf-8')
        nll_ttt_req = urllib.request.Request(
            f'{utils.CONFIG.nll.url}/ttt/{utils.CONFIG.nll.area}/iasp91/',
            data=nll_ttt_data,
            headers={'Content-Type': 'application/json'}
        )
        try:
            nll_ttt = json.load(urllib.request.urlopen(nll_ttt_req))
            for netsta, ttt in nll_ttt.items():
                if netsta not in result:
                    result[netsta] = {}
                result[netsta]['nll_ttt'] = ttt['ttt']
        except:
            pass
    return result

@app.post('/api/takeoffangle', tags=['api'])
def get_takeoffangle(args: TTTQuery, username: Annotated[str, Depends(check_authentication)]):
    return processing.takeoffangle(args)

@app.get('/api/region', tags=['api'])
def get_region_name(longitude: float, latitude: float, username: Annotated[str, Depends(check_authentication)]):
    return utils.get_region(longitude, latitude)

@app.post('/api/compute_magnitudes', tags=['api'])
async def compute_magnitudes(request: Request, username: Annotated[str, Depends(check_authentication)]):
    qml = await request.body()
    return processing.compute_magnitudes_with_scamp_and_scmag(qml)

@app.post('/api/relocate', tags=['api'])
async def relocate(locator: Literal['LOCSAT', 'NonLinLoc'], profile: str, request: Request, username: Annotated[str, Depends(check_authentication)]):
    qml = await request.body()
    if locator == 'LOCSAT':
        result = processing.relocate_with_scp_api(qml, profile)
    elif locator == 'NonLinLoc':
        result = processing.relocate_with_nll(qml, profile)
    return result

@app.post('/api/compute_focal_mechanisms', tags=['api'])
async def compute_focal_mechanisms(request: Request, username: Annotated[str, Depends(check_authentication)]):
    qml = await request.body()
    return processing.compute_focal_mechanisms_with_skhash(qml, params=request.query_params)

@app.post('/api/script/{index}', tags=['api'])
async def launch_script(index: int, request: Request, username: Annotated[str, Depends(check_authentication)]):
    qml = await request.body()
    return utils.launch_script(utils.CONFIG.action_scripts[index].script, qml)

@app.post('/api/commit', tags=['api'])
async def commit(request: Request, username: Annotated[str, Depends(check_authentication)]):
    qml = await request.body()
    if utils.CONFIG.commit_strategy == 'script':
        result = utils.commit_script(qml)
    elif utils.CONFIG.commit_strategy == 'scdispatch':
        result = utils.commit_with_scdispatch(qml)
    else:
        result = { 'message': f'invalid commit strategy: {utils.CONFIG.commit_strategy}', 'return_code': 1 }
    return result

@app.get('/fdsnws/event/1/{query}', tags=['fdsnws'])
def get_events(query: str, request: Request, username: Annotated[str, Depends(check_authentication)]):
    if utils.CONFIG.access.restricted:
        utils.apply_user_rules('GET', username, request.query_params)
    req = f'http://{utils.CONFIG.fdsnws.event_host}/fdsnws/event/1/{query}?{urllib.parse.urlencode(request.query_params)}'
    try:
        response = urllib.request.urlopen(req)
        return Response(content=response.read(), media_type=response.headers.get_content_type())
    except urllib.request.HTTPError as e:
        return 
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
    if utils.CONFIG.access.restricted:
        utils.apply_user_rules('GET', username, request.query_params)
    req = f'http://{utils.CONFIG.fdsnws.dataselect_host}/fdsnws/dataselect/1/query?{urllib.parse.urlencode(request.query_params)}'
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
    def iter_content():
        with urllib.request.urlopen(req) as response:
            while True:
                chunk = response.read(1024)
                if not chunk:
                    break
                yield chunk
    return StreamingResponse(iter_content(), media_type='application/vnd.fdsn.mseed')
