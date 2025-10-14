# Webpicker

The Webpicker is a web application used to process seismological events. It proposes a lot of features such as catalog browsing, waveforms data visualization, signal processing, phase picking, origin relocation, magnitudes computation, first motion determination, multi user.

It relies on standard such as FDSNWS, FDSN StationXML, QuakeML, MSEED.

## Installation

Clone project with submodules and enter webpicker directory:
```
git clone --recurse-submodules -b new https://kleos.unice.fr/cheze/webpicker.git
cd webpicker
```

Install python dependencies:
```
pip install -r requirements.txt
```

Install javascript dependencies and build project:
```
npm i
npm run build
```

## Run and configure the webpicker

Run with uvicorn:
```
uvicorn --host 0.0.0.0 --port 8000 main:app
```
The webpicker will be available at the port 8000. At first connexion, you will be prompt to enter an author name which is used to sign added objects created by your actions, such as picks, and origin (re)locations.

The general configuration of the webpicker can be done by editing the file `config.json` or online at the adresse http://localhost:8000/config. To save the configuration edited online, the admin password must be entered. The default password is `#WebPicker4Dm!n`. The admin password can be change by setting the constant `ADMIN_PASSWORD` in `main.py` which contains the md5 hash of the password. The md5 hash can be produced with the following code:

```python
import hashlib
hashlib.md5(b'#WebPicker4Dm!n').hexdigest()
```
