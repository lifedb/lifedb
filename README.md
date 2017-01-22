# LifeDB

## Getting set up
- Run ```python setup.py develop```
- Run ```python bin/sync_conf.py```
- Gmail
    - Turn on the Gmail API [here](https://developers.google.com/gmail/api/quickstart/python)
        - Set 'Where will you be calling the API from?' to 'Other UI (e.g., Windows, CLI tool)'
    - Add GOOGLE_API_CLIENT_ID to ```./conf/conf.json```
    - Add GOOGLE_API_CLIENT_SECRET to ```./conf/conf.json```
    - Download JSON credentials to ```./conf/google.conf.json```
    - Create a file ```./conf/google.auth.conf.json```
    - Add GOOGLE_API_CLIENT_SECRET_FILEPATH to ```./conf/conf.json```
    - Add GOOGLE_API_CLIENT_AUTH_FILEPATH set to ```./conf/google.auth.conf.json``` to ```./conf/conf.json```
- Fitbit
    - Register a new application [here](https://dev.fitbit.com)
    - Set callback url to http://127.0.0.1:8080
    - Copy over Client ID and Client Secret to appropriate values in ```conf.json```
    - Run ./bin/fitbit_get_auth.py and copy over appropriate values to ```conf.json```

## TODO
- Add Toggl API [link](https://github.com/toggl/toggl_api_docs)
- Create input abstraction

## Contributing
- Add any package requirements to setup.py