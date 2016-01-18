'use strict';

angular.module('bahmni.common.offline')
    .service('offlineSyncService', ['eventLogService', 'offlineDao', '$interval', '$q', 'offlineService',
        function (eventLogService, offlineDao, $interval, $q, offlineService) {
            var scheduler;
            if (offlineService.getAppPlatform() === Bahmni.Common.Constants.platformType.android) {
                offlineDao = Android;
            }

            var sync = function () {
                offlineDao.getMarker().then(function (marker) {
                    if (marker == undefined) {
                        //todo: Hemanth|Santhosh get catchment number from login location
                        marker = {catchmentNumber: 202020}
                    }
                    syncForMarker(marker);

                });
            };

            var syncForMarker = function (marker) {
                eventLogService.getEventsFor(marker.catchmentNumber, marker.lastReadEventUuid).then(function (response) {
                    if (response.data == undefined || response.data.length == 0) {
                        scheduleSync();
                        return;
                    }
                    readEvent(response.data, 0).then(sync);
                });
            };

            var scheduleSync = function () {
                scheduler = $interval(function () {
                    $interval.cancel(scheduler);
                    sync();
                }, 300000, false);
            };

            var readEvent = function (events, index) {
                if (events.length == index)
                    return;

                var event = events[index];
                return eventLogService.getDataForUrl(event.object).then(function (response) {
                    return saveData(event, response).then(updateMarker(event).then(function () {
                        return readEvent(events, ++index);
                    }));
                });
            };

            var saveData = function (event, response) {
                var deferrable = $q.defer();
                switch (event.category) {
                    case 'patient':
                        offlineDao.createPatient({patient: response.data}).then(function () {
                            deferrable.resolve();
                        });
                        break;
                    case 'Encounter':
                        deferrable.resolve();
                        break;
                    case 'addressHierarchy':
                        offlineDao.insertAddressHierarchy(response.data).then(function () {
                            deferrable.resolve();
                        });
                        break;
                    default:
                        deferrable.resolve();
                        break;
                }
                return deferrable.promise;
            };

            var updateMarker = function (event) {
                return offlineDao.insertMarker(event.uuid, 202020);
            };

            return {
                sync: sync
            }
        }
    ]);