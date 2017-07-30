(function() {

    function getHtmlNodes(listId) {
        var htmlNodes = {
            clearKeywords: $('#' + listId + '-clear-keywords'),
            keywords: $('#' + listId + '-keywords'),
            list: $('#' + listId + '-list'),
            loader: $('#' + listId + '-loader'),
            pages: $('#' + listId + '-pages'),
            pageSize: $('#' + listId + '-page-size'),
            pageSizeList: $('#' + listId + '-page-size-dropdown'),
            paginationBar: $('#' + listId + '-pagination'),
            searcher: $('#' + listId + '-searcher'),
            wrapper: $('#' + listId + '-wrapper')
        };
        return htmlNodes;
    }

    function PaginatedList(listId, fetcher, renderOptions) {
        this.listId = listId;
        this.fetcher = fetcher || function(state) {
            return Promise.resolve(PaginatedListService.getDefaultData());
        };
        this.renderOptions = renderOptions || {};
        this.renderOptions.noResultsHtml = this.renderOptions.noResultsHtml || '<i>No results found</i>';
        this.renderOptions.elementDrawer = this.renderOptions.elementDrawer || function(element, state) {
            return '<li class= "list-group-item">' + element + '</li>';
        };
        this.htmlNodes = getHtmlNodes(listId);
    }

    function eventDelayer(eventHandler, delay) {
        var timeOut = null;
        delay = delay || 300;
        return function(event) {
            if (timeOut) {
                clearTimeout(timeOut);
            }
            timeOut = setTimeout(function() {
                timeOut = null;
                eventHandler(event);
            }, delay);
        };
    }

    function getActionDispatcher(store, paginatedList, actionType) {
        return function (actionData) {
            actionData.type = paginatedList.listId + ':' + actionType;
            store.dispatch(function(dispatch) {
                dispatch(actionData);
                paginatedList.fetcher(store.getState())
                .then(function(listResults) {
                    store.dispatch({
                        listResults: listResults,
                        type: paginatedList.listId + ':updateResults'
                    });
                });
            });
        };
    }

    function PaginatedListService() {

        return {
            attachActions: attachActions,
            create: create,
            getDefaultData: getDefaultData,
            getDefaultState: getDefaultState,
            getReducer: getReducer,
            render: render
        };

        function attachActions(paginatedList, store) {
            var handlers = {};
            handlers.pageButtons = getActionDispatcher(store, paginatedList, 'pageButtons');
            handlers.pageSizeList = getActionDispatcher(store, paginatedList, 'pageSizeList');
            handlers.searcher = getActionDispatcher(store, paginatedList, 'searcher');
            handlers.initialize = getActionDispatcher(store, paginatedList, 'initialize');

            attachHandlers(paginatedList, handlers);
        }

        function attachHandlers(paginatedList, handlers) {
            paginatedList.htmlNodes.keywords.on('keyup', eventDelayer(function(event) {
                handlers.searcher({
                    keywords: event.target.value
                });
            }));
            paginatedList.htmlNodes.pageSizeList.on('click', '.dropdown-option', function(event) {
                handlers.pageSizeList({
                    pageSize: $(event.target).data('size'),
                    type: 'pageSizeList'
                });
            });
            paginatedList.htmlNodes.pages.on('click', '.enabled > .page-button', function(event) {
                handlers.pageButtons({
                    movement: $(event.target).data('page-action')
                });
            });
            paginatedList.htmlNodes.clearKeywords.on('click', function(event) {
                handlers.initialize({
                    loadPhase: 'loading'
                });
            });
        }

        function create(listId, fetcher, renderOptions) {
            return new PaginatedList(listId, fetcher, renderOptions);
        }

        function getDefaultData() {
            var defaultData = {
                Items: [],
                TotalPages: 0
            };
            return defaultData;
        }

        function getDefaultState() {
            var defaultState = {
                hasSearcher: false,
                hasPagination: false,
                keywords: '',
                loadPhase: 'not-loaded',
                loadPhases: ['not-loaded', 'loading', 'loaded'],
                page: 0,
                pageSize: 10,
                pageSizeOptions: [10, 25, 50],
                pageOffset: 0,
                pagesNumber: 5,
                results: [],
                searcherPlaceholder: 'Search ...',
                totalPages: 0
            };
            return defaultState;
        }

        function getReducer(paginatedList) {
            return function(state, action) {
                if (typeof state === 'undefined') {
                    state = getDefaultState();
                }

                switch (action.type) {
                    case paginatedList.listId + ':initialize':
                        var hasSearcher = action.config && action.config.hasSearcher != null ?
                            action.config.hasSearcher :
                            state.hasSearcher;
                        var hasPagination = action.config && action.config.hasPagination != null ?
                            action.config.hasPagination :
                            state.hasPagination;
                        var loadPhase = action.loadPhase != null ? action.loadPhase : state.loadPhase;
                        return {
                            ...state,
                            hasSearcher,
                            hasPagination,
                            loadPhase,
                            keywords: '',
                            page: 0,
                            pageOffset: 0
                        };
                    case paginatedList.listId + ':pageButtons':
                        var page = 0;
                        var pageOffset = state.pageOffset;
                        if (!isNaN(action.movement)) {
                            page = parseInt(action.movement);
                        }
                        else if (action.movement === 'previous' && (state.pageOffset - state.pagesNumber) >= 0) {
                            pageOffset = state.pageOffset - state.pagesNumber;
                        }
                        else if (action.movement === 'following' &&
                        (state.pageOffset + state.pagesNumber) < state.totalPages) {
                            pageOffset = state.pageOffset + state.pagesNumber;
                        }
                        return {
                            ...state,
                            page,
                            pageOffset,
                            loadPhase: 'loading'
                        };
                    case paginatedList.listId + ':pageSizeList':
                        return {
                            ...state,
                            loadPhase: 'loading',
                            pageSize: action.pageSize,
                            page: 0,
                            pageOffset: 0
                        };
                    case paginatedList.listId + ':searcher':
                        return {
                            ...state,
                            loadPhase: 'loading',
                            keywords: action.keywords,
                            page: 0,
                            pageOffset: 0
                        };
                    case paginatedList.listId + ':updateResults':
                        var loadPhase = action.loadPhase != null ? action.loadPhase : 'loaded';                    
                        var keywords = action.keywords != null ? action.keywords : state.keywords;                    
                        return {
                            ...state,
                            loadPhase,
                            keywords,
                            results: action.listResults.Items,
                            totalPages: action.listResults.TotalPages,
                        };
                    default:
                        return state;
                }
            };
        }

        function render(paginatedList, state, listState) {

            paginatedList.htmlNodes.loader.parent().removeClass(listState.loadPhases.join(' ')).addClass(listState.loadPhase);

            paginatedList.htmlNodes.keywords.attr('placeholder', listState.searcherPlaceholder);
            if (listState.hasSearcher) {
                paginatedList.htmlNodes.keywords.val(listState.keywords);
                if (listState.keywords && listState.keywords.length > 0) {
                    paginatedList.htmlNodes.clearKeywords.show();
                }
                else {
                    paginatedList.htmlNodes.clearKeywords.hide();
                }
                paginatedList.htmlNodes.searcher.show();
            }
            else {
                paginatedList.htmlNodes.searcher.hide();
            }

            if (listState.loadPhase !== 'loading') {
                if (listState.hasPagination) {
                    var pagesNumber = Math.min(listState.pagesNumber, listState.totalPages - listState.pageOffset);
                    if (pagesNumber) {
                        var pagination = '<li class= "' + ((listState.pageOffset - listState.pagesNumber) >= 0 ?
                            'enabled' :
                            'disabled') +
                        '"><span class= "page-button" data-page-action= "previous">&laquo;</span></li>';
                        for (var i = 0; i < pagesNumber; ++i) {
                            pagination += '<li class= "' + (listState.page === i ?
                                'active' :
                                'enabled') +
                            '"><span class= "page-button" data-page-action= "' + i + '">' +
                            (listState.pageOffset + i + 1) + '</span></li>';
                        }
                        pagination += '<li class= "' + ((listState.pageOffset + listState.pagesNumber) < listState.totalPages ?
                                'enabled' :
                                'disabled') +
                        '"><span class= "page-button" data-page-action= "following">&raquo;</span></li>';
                        paginatedList.htmlNodes.pages.html(pagination);

                        paginatedList.htmlNodes.pageSizeList.empty();
                        listState.pageSizeOptions.forEach(function(option) {
                            paginatedList.htmlNodes.pageSizeList.append(
                                '<li class= "text-right"><span class= "dropdown-option" data-size= "' +
                                option + '">' + option + '</span></li>');
                        });

                        paginatedList.htmlNodes.paginationBar.show();
                    }
                    else {
                        paginatedList.htmlNodes.paginationBar.hide();
                    }

                    paginatedList.htmlNodes.pageSize.text(listState.pageSize);
                }
                else {
                    paginatedList.htmlNodes.paginationBar.hide();
                }

                paginatedList.htmlNodes.list.empty();
                if (!listState.results || !listState.results.length) {
                    paginatedList.htmlNodes.list.append(paginatedList.renderOptions.noResultsHtml);
                }
                else {
                    listState.results.map(function(element) {
                        return paginatedList.renderOptions.elementDrawer(element, state);
                    })
                    .forEach(function(element) {
                        paginatedList.htmlNodes.list.append(element);
                    });
                }
            }
        }
    }
    
    window.PaginatedList = PaginatedList;
    window.PaginatedListService = new PaginatedListService();

})();