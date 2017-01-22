import httplib2
from apiclient import discovery

from google import get_credentials

def dostuff():
    credentials = get_credentials('https://www.googleapis.com/auth/gmail.readonly')
    http = credentials.authorize(httplib2.Http())
    service = discovery.build('gmail', 'v1', http=http)

    results = service.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])

    if not labels:
        print('No labels found.')
    else:
        print('Labels:')
        for label in labels:
            print(label['name'])