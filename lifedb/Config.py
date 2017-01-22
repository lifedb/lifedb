import json
from pprint import pprint

def readConf(path):
    file = open(path, 'r')

    conf = {}
    try:
        conf = json.load(file)
    except:
        print "WARNING: Could not read; overwriting " + path + " because we live dangerously"

    file.close()

    return conf

def writeConf(conf, path):
    with open(path, 'w') as f:
        f.write(json.dumps(conf, indent=2, sort_keys=True))

class Config():
    class __Config:
        def __init__(self, path):
            self.path = path
            self.data = readConf(self.path)

        def __str__(self):
            pprint.pformat(self.data)

    instance = None
    def __init__(self, path = './conf/conf.json'):
        if not Config.instance:
            Config.instance = Config.__Config(path)

    def show(self):
        pprint(Config.instance.data)

    def get(self, key):
        return Config.instance.data[key]

    def sync(self, examplePath = './conf/conf.json.example'):
        conf = Config.instance.data
        confExample = readConf(examplePath)

        for key in confExample:
            if key not in conf.keys():
                conf[key] = confExample[key]

        for key in conf:
            if key not in confExample.keys():
                confExample[key] = "DUMMY_VALUE"

        writeConf(conf, Config.instance.path)
        writeConf(confExample, examplePath)