import requests

from lifedb import Config

# Documentation: https://www.rescuetime.com/anapi/setup/documentation

class RescueTime():

    def __init__(self):
        self.baseURL = 'https://www.rescuetime.com/anapi/data'
        self.apiKey = Config().get('RESCUETIME_API_KEY')

        print self.apiKey

    def get(self, **kwargs):
        request = requests.get(self.baseURL, params={
            'key': self.apiKey,
            'format': 'json',
        })
        print request.url
        print request.text
