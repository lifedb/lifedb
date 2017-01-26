import datetime
import dateutil.parser

import lifedb

import matplotlib.pyplot as plt
import numpy

numDays = 7

first = datetime.date.today() - datetime.timedelta(days = 8)
dates = [datetime.date.today() - datetime.timedelta(days = x) for x in range(0, numDays)]
dateStrings = [date.strftime('%Y-%m-%d') for date in dates]
data = {date: {} for date in dateStrings}

# ### GET FITBIT DATA
# fitbit = lifedb.inputs.fitbit.Fitbit()
#
# weights = fitbit.api('get_bodyweight',
#           base_date = min(dates),
#           end_date = max(dates))
#
# for weight in weights['weight']:
#     data[weight['date']] = {
#         'weight': weight['weight'],
#         'fat': weight['fat']
#     }
#
# for date in dates:
#     sleep = fitbit.api('get_sleep', date = date)
#     sleep = filter(lambda x: x['isMainSleep'], sleep['sleep'])[0]
#
#     sleepStart = dateutil.parser.parse(sleep['startTime'])
#     sleepEnd = sleepStart + datetime.timedelta(milliseconds=sleep['duration'])
#
#     data[sleep['dateOfSleep']]['sleepStart'] = sleepStart
#     data[sleep['dateOfSleep']]['sleepEnd'] = sleepEnd
#
# ### GET GMAIL DATA
# gmail = lifedb.inputs.gmail.Gmail()
# id = gmail.getLabelIds('Running')
# messages = gmail.getMessagesWithLabels(labelIds=[id])
#
# for message in messages:
#     date = datetime.datetime.fromtimestamp(int(message['internalDate'])/1000)
#     date = datetime.date(date.year, date.month, date.day)
#
#     if date >= min(dates) and date <= max(dates):
#         subject = filter(lambda x: x['name'] == 'Subject', message['payload']['headers'])[0]
#         data[date.strftime('%Y-%m-%d')]['running'] = float(subject['value'].split(' ')[0])
#
# ### PLOTTING
# def getTimeSeries(label):
#     return [data[date][label] if label in data[date].keys() else 0 for date in dateStrings]
#
# data = {'2017-01-22': {'sleepEnd': datetime.datetime(2017, 1, 22, 6, 44), 'sleepStart': datetime.datetime(2017, 1, 22, 0, 0), 'running': 3.49, 'fat': 15.5, 'weight': 146.2}, '2017-01-21': {'sleepEnd': datetime.datetime(2017, 1, 21, 7, 43), 'sleepStart': datetime.datetime(2017, 1, 20, 23, 4), 'fat': 15.699999809265137, 'weight': 147}, '2017-01-20': {'sleepEnd': datetime.datetime(2017, 1, 20, 7, 16), 'sleepStart': datetime.datetime(2017, 1, 20, 1, 46), 'fat': 15.899999618530273, 'weight': 147.4}, '2017-01-16': {'sleepEnd': datetime.datetime(2017, 1, 16, 7, 49, 30), 'sleepStart': datetime.datetime(2017, 1, 15, 22, 41, 30), 'fat': 16, 'weight': 148.4}, '2017-01-17': {'sleepEnd': datetime.datetime(2017, 1, 17, 7, 0), 'sleepStart': datetime.datetime(2017, 1, 16, 22, 49), 'running': 3.35, 'fat': 16.100000381469727, 'weight': 148.2}, '2017-01-18': {'sleepEnd': datetime.datetime(2017, 1, 18, 5, 29, 30), 'sleepStart': datetime.datetime(2017, 1, 17, 20, 30, 30), 'running': 3.41, 'fat': 16.100000381469727, 'weight': 148.4}, '2017-01-19': {'sleepEnd': datetime.datetime(2017, 1, 19, 7, 28), 'sleepStart': datetime.datetime(2017, 1, 19, 0, 4), 'fat': 15.600000381469727, 'weight': 147.4}}
# dateTitle = ' (Week of %s)' % first.strftime('%Y-%m-%d')
#
# ### RUNNING
# running = getTimeSeries('running')
# title = 'Running' + dateTitle
#
# dates.reverse()
# extendedDates = [first]
# extendedDates.extend(dates)
#
# running.reverse()
#
# fig, ax = plt.subplots()
# plt.ylim(3, 4)
#
# ax.bar(range(len(running)), running)
# ax.set_ylabel('Miles in 30 minutes')
# ax.set_title(title)
# ax.set_xticklabels(extendedDates)
# fig.autofmt_xdate()
#
# fig.savefig('./plots/' + title + '.png', dpi=fig.dpi)
#
# ### BODY
# fig = plt.figure()
# ax = fig.gca()
# plt.ylim(140, 150)
#
# weight = getTimeSeries('weight')
# fat = getTimeSeries('fat')
#
# weight.reverse()
# fat.reverse()
#
# title = 'Body' + dateTitle
#
# ax.bar(range(numDays), weight)
# ax.set_ylabel('lbs')
# ax.set_title(title)
# ax.set_xticklabels(extendedDates)
# fig.autofmt_xdate()
#
# ax2 = ax.twinx()
# ax2.set_ylim([8, 20])
# ax2.plot(range(numDays), fat, color='orange')
# ax2.set_ylabel('% body fat')
#
# fig.savefig('./plots/' + title + '.png', dpi=fig.dpi)
#
# ### SLEEP
# fig, ax = plt.subplots()
# plt.ylim(-5, 5)
#
# sleepStart = getTimeSeries('sleepStart')
# sleepEnd = getTimeSeries('sleepEnd')
#
# def time_in_seconds(dt):
#     time = dt.hour * 60 * 60 + dt.minute * 60 + dt.second
#     if time < 12 * 60 * 60:
#         time += 24 * 60 * 60
#     return time
#
# sleepStart = [time_in_seconds(x) for x in sleepStart]
# sleepEnd = [time_in_seconds(x) for x in sleepEnd]
#
# sleepStartMean = numpy.mean(sleepStart)
# sleepEndMean = numpy.mean(sleepEnd)
#
# sleepStart = [(x - sleepStartMean) / 3600 for x in sleepStart]
# sleepEnd = [(x - sleepEndMean) / 3600 for x in sleepEnd]
#
# sleepStart.reverse()
# sleepEnd.reverse()
#
# title = 'Sleep' + dateTitle
# ax.plot(range(numDays), sleepStart, label='Start')
# ax.plot(range(numDays), sleepEnd, color='orange', label='End')
# ax.set_ylabel('Hours from mean')
# ax.set_title(title)
# ax.set_xticklabels(extendedDates)
# fig.autofmt_xdate()
#
# plt.legend(loc='best')
#
# fig.savefig('./plots/' + title + '.png', dpi=fig.dpi)

### TODO: WORK: Toggl
### TODO: Reading: Toggl
### TODO: Calisthenics: Email
### TODO: Rescuetime
# rescuetime = lifedb.inputs.rescuetime.RescueTime()
# print(rescuetime.get())

### TODO: Automatic

### TODO: Plaid
# plaid = lifedb.inputs.plaid.Plaid()
# print(plaid.api('connect', 'bofa', {
#     'username': '***',
#     'password': '***'
# }).json())