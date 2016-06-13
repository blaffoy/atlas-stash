"use strict";
var _ = require("lodash"),
    url = require("url"),
    request = require("requestretry"),
    PagedRequest = require("./paged-request").PagedRequest,
    EventEmitter = require("events").EventEmitter,
    API_BASE = "/rest/api/1.0/";

var StashApi = exports.StashApi = function(protocol, hostname, port, user, password) {
    this.protocol = protocol || "http";
    this.hostname = hostname;
    this.port     = port;
    this.user     = user;
    this.password = password;

};

(function(){

    var _connectionDetails = function (obj) {
        return {
            protocol: obj.protocol,
            hostname: obj.hostname,
            port:     obj.port,
            user:     obj.user,
            password: obj.password
        };
    },
    _buildPagedRequest = function (obj) {
        var pReq = new PagedRequest(_connectionDetails(obj));
        _.defer(_.bind(pReq.remaining, pReq));
        return pReq;
    };

    this.request = function(options, callback, errback) {
        if(!_.isObject(options)) {
            options = {};
        }
        if(!_.isFunction(errback)) {
            errback = function(error) {
                callback(null, error);
            };
        }

        options.uri = decodeURIComponent(url.format({
            protocol: this.protocol,
            hostname: this.hostname,
            port: this.port,
            pathname: API_BASE + options.endpoint
        }));
        options.json = true;
        options.auth = {
            user: this.user,
            pass: this.password
        };
        options.maxAttempts = 5;
        options.retryDelay = 500;

        request(options, function(error, response, body) {
            if(error) {
                errback(error);
                return;
            }

            callback(body);
        });
    };

    /**
     * Get a list of all projects in Stash
     *
     * @return {PagedRequest}
     */
    this.projects = function () {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects");
    };

    /**
     * Get a list of all repos associated with a project
     *
     * @param {string} projectKey
     * @return {PagedRequest}
     */
    this.repos = function (projectKey) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos");
    };

    this.buildStatus = function (commit) {
        var pReq = _buildPagedRequest(this);
        // The Stash build integration plugin places build info at a different endpoint
        return pReq.start("GET", "../../build-status/1.0/commits/"+commit);
    };

    this.pullRequests = function (projectKey, repositorySlug) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/pull-requests" );
    };

    this.pullRequest = function (projectKey, repositorySlug, pullRequestId) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/pull-requests/"+pullRequestId);
    }

    this.pullRequestMerge = function(projectKey, repositorySlug, pullRequestId) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/pull-requests/"+pullRequestId+"/merge");
    };

    this.pullRequestBuildStatus = function (projectKey, repositorySlug, pullRequestId) {
        var that = this;

        const statusEmitter = new EventEmitter();

        this.pullRequest(projectKey, repositorySlug, pullRequestId)
            .on('error', function(error) {statusEmitter.emit('error', error)})
            .on('allPages', function(data) {
                that.buildStatus(data[0]['fromRef']['latestChangeset'])
                    .on('start', function() {statusEmitter.emit('start');})
                    .on('newPage', function(page) {statusEmitter.emit('newPage', page);})
                    .on('allPages', function(data) {statusEmitter.emit('allPages', data);})
                    .on('end', function() {statusEmitter.emit('end');})
                    .on('error', function(error) {statusEmitter.emit('error', error);});
            });

        return statusEmitter;
    };

    this.branches = function (projectKey, repositorySlug) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/branches" );
    };

    this.tags = function (projectKey, repositorySlug) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/tags" );
    };

    this.commits = function (projectKey, repositorySlug, branch) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/commits?until=" + encodeURIComponent(branch) );
    };

    this.fileContents = function (projectKey, repositorySlug, fileName, branch) {
        var pReq = _buildPagedRequest(this);
        return pReq.start("GET", "projects/"+projectKey+"/repos/"+repositorySlug+"/browse/" + encodeURIComponent(fileName) + "?raw&at=" + encodeURIComponent(branch) );
    };

}).call(StashApi.prototype);
