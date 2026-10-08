# Daan Forest Park map database

Map snapshot and derived database: ODbL-1.0, © OpenStreetMap contributors.
Attribution: https://www.openstreetmap.org/copyright
License: https://opendatacommons.org/licenses/odbl/1-0/

Download [the complete metre-space database](daan-forest-pilot.json) and
[the original Overpass snapshot](source/daan-overpass.json.gz).
Source timestamp and SHA-256 are inside the database. No OSM tiles were downloaded.
The game widens roads and uses fictional Q-style buildings, trees and riding.
POI game markers are placed on nearby paths rather than surveyed facility centres.

Rebuild with Python 3:
`python3 compile_map.py source/daan-overpass.json.gz daan-forest-pilot.json`

The query is `daan.overpassql`. The compiler code is Apache-2.0 (CODE-LICENSE.txt).
The geographic database remains ODbL, independently of the game-code license.
