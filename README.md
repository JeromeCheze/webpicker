[![DOI](https://zenodo.org/badge/1262877972.svg)](https://doi.org/10.5281/zenodo.20595572)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

# Webpicker

The Webpicker is a web application used to process seismological events. It proposes a lot of features such as catalog browsing, waveforms data visualization, signal processing, phase picking, origin relocation, magnitudes computation, first motion determination, multi user.

It relies on standards such as FDSNWS, FDSN StationXML, QuakeML, MSEED.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

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
