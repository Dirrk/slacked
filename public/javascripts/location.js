/**
 * Created by Derek Rada on 12/11/2014.
 */

var ngLocationSlackedApp = angular.module('ngLocationSlackedApp', ["ngRoute"]);

ngLocationSlackedApp.controller('ngSidebarController', [ "$scope", "$http", function ngSidebarController($scope, $http) {

    $scope.channels = [{locationId: null, name: "Loading.."}];
    $scope.groups = [{locationId: null, name: "Loading.."}];

}]);

ngLocationSlackedApp.controller('ngMessageViewer', [ "$scope", "$http", function ngMessageViewer($scope, $http) {

    $scope.messages = [{ts: tsToDateString(), name: "Slacked", msg: "No messages"}];

    /*
    $scope.$on("updateMessages", function (event, args) {

    });
    */

}]);

/***
 * tsToDateString
 * @param id [number]
 * @returns {string}
 */
function tsToDateString(id) {
    if (id && typeof id == "number") {

        return new Date(id).toLocaleDateString() + " " + new Date(id).toLocaleTimeString();
    } else {
        return new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
    }
}


ngLocationSlackedApp.config(
    [ '$routeProvider',
      function($routeProvider) {
          $routeProvider.
              when('/history/:locationId', {
                    templateUrl: "partials/channel-history.html",
                    controller: "channelHistoryController"
               }).
              when('/group/:locationId', {
                    templateUrl: "partials/channel-history.html",
                    controller: "groupHistoryController"
               })
      }
    ]
);
