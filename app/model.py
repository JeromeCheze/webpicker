from enum import Enum
from pydantic import BaseModel, Field
from typing import Literal, Optional, Union

class ActivityData(BaseModel):
    id: str
    author: str
    state: str
    event: str

class ChatData(BaseModel):
    id: str
    time: str
    expeditor: str
    recipient: str
    broadcast: bool
    message: str

class WSVersionResponse(BaseModel):
    type: Literal['version'] = 'version'
    data: str

class WSChatResponse(BaseModel):
    type: Literal['chat'] = 'chat'
    data: ChatData

class WSActivityResponse(BaseModel):
    type: Literal['activity'] = 'activity'
    data: list[ActivityData]

class WSUpdateEventResponse(BaseModel):
    type: Literal['updateEvent'] = 'updateEvent'
    data: str

class ArgsDataRequest(BaseModel):
    station: str
    network: str
    location: str
    channel: str
    starttime: str
    endtime: str

class ConfigArgs(BaseModel):
    detector: str | None = "phasenet"
    output_format: str | None = "quakeml"
    dataset: str | None = "original"
    p_threshold: float | None = 0.3
    s_threshold: float | None = 0.3
    event_threshold: float | None = 0.3
    denoiser: bool = False
    amplitude: bool = False
    query_data: ArgsDataRequest | None = None

class DetectorRequestBase(BaseModel):
    filter: str | None = "HP_2"
    args: ConfigArgs
    fdsn_dataselect: str

class DenoisingArgs(BaseModel):
    detector: str | None = "deepdenoiser"
    query_data: ArgsDataRequest
    dataset: str | None = "original"

class DenoisingRequest(BaseModel):
    fdsn_dataselect: str
    args: DenoisingArgs
    filter: str | None = "HP_1"

class TTTQuery(BaseModel):
    latitude: float
    longitude: float
    depth: float
    station: dict[str, tuple[float, float, float]]

class FDSNEventQuery(BaseModel):
    starttime: str = Field(exclude=True)
    endtime: str = Field(exclude=True)
    minlatitude: float = Field(exclude=True)
    maxlatitude: float = Field(exclude=True)
    minlongitude: float = Field(exclude=True)
    maxlongitude: float = Field(exclude=True)
    latitude: float = Field(exclude=True)
    longitude: float = Field(exclude=True)
    minradius: float = Field(exclude=True)
    maxradius: float = Field(exclude=True)
    mindepth: float = Field(exclude=True)
    maxdepth: float = Field(exclude=True)
    minmagnitude: float = Field(exclude=True)
    maxmagnitude: float = Field(exclude=True)
    eventtype: str = Field(exclude=True)
    includeallorigins: bool = Field(exclude=True)
    includeallmagnitudes: bool = Field(exclude=True)
    includearrivals: bool = Field(exclude=True)
    eventid: str = Field(exclude=True)
    format: Literal['xml', 'text'] = Field(exclude=True)

class FDSNStationQuery(BaseModel):
    starttime: Optional[str] = None
    endtime: Optional[str] = None
    startbefore: Optional[str] = None
    endbefore: Optional[str] = None
    startafter: Optional[str] = None
    endafter: Optional[str] = None
    network: Optional[str] = None
    station: Optional[str] = None
    location: Optional[str] = None
    channel: Optional[str] = None
    minlatitude: Optional[float] = -90.0
    maxlatitude: Optional[float] = 90.0
    minlongitude: Optional[float] = -180.0
    maxlongitude: Optional[float] = 180.0
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0
    minradius: Optional[float] = 0.0
    maxradius: Optional[float] = 180.0
    level: Optional[Literal['network', 'station', 'channel', 'response']] = 'station'
    format: Optional[Literal['xml', 'text']] = 'text'

class FDSNDataselectQuery(BaseModel):
    starttime: Optional[str] = None
    endtime: Optional[str] = None
    network: Optional[str] = None
    station: Optional[str] = None
    location: Optional[str] = None
    channel: Optional[str] = None

class ConfigUser(BaseModel):
    password: str
    rules: dict[str, str]

class ConfigAccess(BaseModel):
    restricted: bool = False
    users: dict[str, ConfigUser] = {}

class ConfigDenoiser(BaseModel):
    enabled: bool = False
    url: str = ''

class ConfigDetector(BaseModel):
    enabled: bool = False
    url: str = ''

class ConfigFDSNWS(BaseModel):
    dataselect_host: str
    event_host: str
    station_host: str

class ConfigLocsat(BaseModel):
    profiles: list[str] = ['iasp91', 'tab']

class ConfigNLL(BaseModel):
    enabled: bool = False
    url: str = ''
    area: str = ''
    profiles: list[str] = []

class ConfigVelest(BaseModel):
    enabled: bool = False
    url: str = ''
    profiles: list[str] = []

class ConfigSeiscomp(BaseModel):
    messaging_host: str = ''
    root: str = ''
    schema_version: str = '0.13'

class ConfigSkhash(BaseModel):
    enabled: bool = False
    python_interpreter: str = ''
    path: str = ''

class ConfigActionScript(BaseModel):
    label: str
    script: str

class Config(BaseModel):
    access: ConfigAccess = ConfigAccess()
    agency: str = 'OCA'
    action_scripts: list[ConfigActionScript] = []
    commit_script: str = '#!/bin/sh\n# $1 : path to the QuakeML file to commit\n>&2 echo "OK"'
    commit_strategy: Literal['script', 'scdispatch'] = 'script'
    denoiser: ConfigDenoiser = ConfigDenoiser()
    detector: ConfigDetector = ConfigDetector()
    fdsnws: ConfigFDSNWS
    locsat: ConfigLocsat = ConfigLocsat()
    nll: ConfigNLL = ConfigNLL()
    velest: ConfigVelest = ConfigVelest()
    seiscomp: ConfigSeiscomp = ConfigSeiscomp()
    skhash: ConfigSkhash = ConfigSkhash()
    title: str = 'WebPicker'
