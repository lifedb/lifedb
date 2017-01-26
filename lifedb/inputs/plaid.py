from __future__ import absolute_import

from plaid import Client
from plaid import errors as plaid_errors
from plaid.utils import json

from lifedb import Config

class Plaid():
    client = None

    def __init__(self):
        if not Plaid.client:
            Plaid.client = \
                Client(client_id=Config().get('PLAID_CLIENT_ID'),
                       secret=Config().get('PLAID_SECRET_KEY'))

    def api(self, method, *args, **kwargs):
        return getattr(Plaid.client, method)(*args, **kwargs)
