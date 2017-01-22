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




## Contributing
- Add any package requirements to setup.py