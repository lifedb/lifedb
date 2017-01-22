from __future__ import absolute_import

import fitbit
from lifedb import Config

class Fitbit():
    client = None

    def __init__(self):
        if not Fitbit.client:
            Fitbit.client = \
                fitbit.Fitbit(Config().get('FITBIT_CLIENT_ID'),
                              Config().get('FITBIT_CLIENT_SECRET'),
                              access_token = Config().get('FITBIT_ACCESS_TOKEN'),
                              refresh_token = Config().get('FITBIT_REFRESH_TOKEN'))

    def api(self, method, **kwargs):
        return getattr(Fitbit.client, method)(**kwargs)
