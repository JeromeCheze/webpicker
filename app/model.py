from pydantic import BaseModel, Field
from typing import Literal, Optional, Union
from enum import Enum

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

class WebSocketMessageType(str, Enum):
    activity = 'activity'
    chat = 'chat'
    version = 'version'

class WebSocketResponse(BaseModel):
    type: WebSocketMessageType
    data: Union[list[ActivityData], ChatData, str]

class WebSocketMessage(BaseModel):
    type: WebSocketMessageType
    data: Union[ActivityData, ChatData]

class WSDetectorArgs(BaseModel):
    network: str
    station: str
    location: str
    channel: str
    starttime: str
    endtime: str
    url: str
    p_threshold: float
    s_threshold: float
    get_probability: bool

class WSDenoiserArgs(BaseModel):
    network: str
    station: str
    location: str
    channel: str
    starttime: str
    endtime: str
    url: str

class TTTQuery(BaseModel):
    latitude: float
    longitude: float
    depth: float
    station: dict[str, tuple[float, float, float]]

class TakeoffAngleQuery(BaseModel):
    depth: float
    station: dict[str, float]

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
