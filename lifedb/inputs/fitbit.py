from __future__ import absolute_import

import datetime
import fitbit
from lifedb import Config

def dostuff():
    client = fitbit.Fitbit(Config().get('FITBIT_CLIENT_ID'),
                           Config().get('FITBIT_CLIENT_SECRET'),
                           access_token = Config().get('FITBIT_ACCESS_TOKEN'),
                           refresh_token = Config().get('FITBIT_REFRESH_TOKEN'))

    print client.get_bodyweight(base_date = datetime.date(2017, 1, 1), end_date = datetime.date.today())