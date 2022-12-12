import os
import sys
# MUST SET THESE ENVIRONMENT VARIABLE ON APACHE LEVEL :
# - SEISCOMP_ROOT=/home/sysop/seiscomp3
# - LD_LIBRARY_PATH=/home/sysop/seiscomp3/lib
sys.path.insert(0, '/home/sysop/seiscomp3/lib/python')
sys.path.insert(0, '/var/www/webpicker')
from site_routage import app as application
