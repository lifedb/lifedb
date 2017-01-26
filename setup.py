from setuptools import setup

setup(
    name='lifedb',
    version='0.0.1',
    packages=['lifedb'],
    url='https://lifedb.io',
    license='MIT',
    author='dsuo',
    author_email='dsuo@post.harvard.edu',
    description='',
    install_requires=[
        'cherrypy',
        'google-api-python-client',
        'fitbit',
        'matplotlib',
        'plaid-python'
    ]
)
