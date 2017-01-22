from oauth2client.file import Storage
from oauth2client import tools
from oauth2client import client

from lifedb import Config

def get_credentials(scopes, flags):
    credential_path = Config().get("GOOGLE_API_CLIENT_AUTH_FILEPATH")
    secret_path = Config().get('GOOGLE_API_CLIENT_SECRET_FILEPATH')

    store = Storage(credential_path)
    credentials = store.get()

    if not credentials or credentials.invalid:
        flow = client.flow_from_clientsecrets(secret_path, scopes)
        flow.user_agent = 'LifeDB'
        credentials = tools.run_flow(flow, store, None)
        print('Storing credentials to ' + credential_path)

    return credentials