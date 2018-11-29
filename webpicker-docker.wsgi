import os
import sys
sys.path.insert(0, '/var/www/webpicker')
os.environ["FDSNWS_EVENT_HOST"] = "localhost:8080"
os.environ["FDSNWS_STATION_HOST"] = "localhost:8080"
os.environ["FDSNWS_DATASELECT_HOST"] = "localhost:8000"
os.environ["SEISCOMP_ROOT"] = "/home/sysop/seiscomp3"
os.environ["SC3_MESSAGING_HOST"] = "localhost:4803"
# Warning change also path in startup.sh
os.environ["SC3ML_INVENTORY_FILENAME"] = "/var/www/webpicker/config/inventory.xml"
os.environ["SC3ML_CONFIG_FILENAME"] = "/var/www/webpicker/config/config.xml"
os.environ["SCP3ML_DISPATCH_VERSION"] = "0.10"
from site_routage import app as application
