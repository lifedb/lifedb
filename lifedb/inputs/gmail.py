import httplib2
from apiclient import discovery
from apiclient import errors

from google import get_credentials

class Gmail():
    client = None

    def __init__(self):
        if not Gmail.client:
            credentials = get_credentials('https://www.googleapis.com/auth/gmail.readonly')
            http = credentials.authorize(httplib2.Http())
            Gmail.client = discovery.build('gmail', 'v1', http=http)

    def api(self, method, **kwargs):
        return getattr(Gmail.client, method)(**kwargs)

    def getLabelIds(self, labels):
        response = Gmail.client.users().labels().list(userId='me').execute()
        labels = filter(lambda x: x['name'] in labels, response.get('labels', []))
        labels = [x['id'] for x in labels]

        return labels[0] if len(labels) == 1 else labels

    def listMessagesWithLabels(self, userId='me', labelIds=[]):
        """List all Messages of the user's mailbox with labelIds applied.

        Args:
          userId: User's email address. The special value "me"
          can be used to indicate the authenticated user.
          labelIds: Only return Messages with these labelIds applied.

        Returns:
          List of Messages that have all required Labels applied. Note that the
          returned list contains Message IDs, you must use get with the
          appropriate id to get the details of a Message.
        """
        try:
            response = Gmail.client.users().messages().list(userId=userId,
                                                       labelIds=labelIds).execute()
            messages = []
            if 'messages' in response:
                messages.extend(response['messages'])

            while 'nextPageToken' in response:
                page_token = response['nextPageToken']
                response = Gmail.client.users().messages().list(userId=userId,
                                                           labelIds=labelIds,
                                                           pageToken=page_token).execute()
                messages.extend(response['messages'])

            return messages
        except errors.HttpError, error:
            print 'An error occurred: %s' % error

    def getMessagesWithLabels(self, userId='me', labelIds=[]):
        messages = self.listMessagesWithLabels(userId, labelIds)

        return [Gmail.client.users().messages().get(userId=userId, id=message['id']).execute() for message in messages]



