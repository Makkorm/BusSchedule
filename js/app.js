(function(){

    var routes = [],
        stops = [],
        windowSize = getWindowSize();


    var vm = new Vue({

        el : '#app',
        data : {
            routes : routes,
            stops : stops,
            markers : [],
            map : {},
            isActive : false,
            routeName : '',
            showMenu : windowSize
        },
        mounted : function(){
            this.initMap();
            axios.get('https://gp-js-test.herokuapp.com/proxy/http://www.minsktrans.by/city/minsk/routes.txt')
                .then(function(response){
                    var basicData = basicParse(response.data),
                        sortBasicData = [],
                        data = [],
                        i;

                    // удаляем маршруты, в которых не даны остановки ( есть два маршрута  ДС Чижовка - кладбище Михановичи, в первом нет данных об остановках, его мы удаляем )

                    for ( i=0; i < basicData.length; i++ ){
                        if ( basicData[i][14] === ''){
                            basicData.splice( i , 1);
                        }
                    }

                    for ( i=0; i < basicData.length; i++ ){
                        // 921 - номер маршрута последнего автобуса, далее идут метро, трамвай и троллейбусы
                        if (basicData[i][0] === '921'){
                            data = basicData.splice(0, i + 1);
                        }
                    }

                    for ( i=0; i < data.length; i++ ){

                        routes.push({
                            Number : data[i][0],
                            Name : data[i][10],
                            Id : data[i][12],
                            Stops : data[i][14]
                        })
                    }

                })
                .catch(function(error){
                    console.log(error)
                });

            axios.get('https://gp-js-test.herokuapp.com/proxy/http://www.minsktrans.by/city/minsk/stops.txt')
                .then(function(response){
                    var data = basicParse(response.data),
                        i;

                    for ( i=0; i < data.length -1; i++ ){
                        stops.push({
                            Id : data[i][0],
                            Name : data[i][4],
                            Lng : data[i][6].slice(0,2) + "." + data[i][6].slice(2),
                            Lat : data[i][7].slice(0,2) + "." + data[i][7].slice(2)
                        })
                    }

                })
                .catch(function(error){
                    console.log(error)
                });
        },
        methods : {
            initMap : function(){
                console.log(this.showMenu)

                var mapOptions = {
                        zoom : 12,
                        center : new google.maps.LatLng(53.896483, 27.551135)
                    },
                    map = new google.maps.Map(document.getElementById('map'), mapOptions);

                this.map = map;

            },
            initRoute : function(stops, index){

                this.cleanMap();

                var stops = stops.split(','),
                    stopsLength = stops.length,
                    allStopsLength = this.stops.length,
                    i,
                    j,
                    markers = [],
                    nameIndex,
                    marker, // init google map marker
                    routeCenterCoord,
                    infoWindow,
                    map = this.map,
                    currentMinLng,
                    currentMaxLng,
                    currentMinLat,
                    currentMaxLat;


                this.routeName = "Выбранный маршрут : <span class='bus-num'>"+ this.routes[index].Number + "</span> "+  this.routes[index].Name;

                for ( i=0; i < allStopsLength; i++ ){
                    for ( j=0; j < stopsLength; j++ ){
                        if ( this.stops[i].Id === stops[j]){
                            if (this.stops[i].Name != ''){
                                markers.push(this.stops[i]);
                            }
                            else {
                                nameIndex = searchBusName(i);
                                markers.push(this.stops[i]);
                                markers[markers.length - 1].Name = nameIndex.Name;
                            }
                        }
                    }
                }

                currentMinLng = currentMaxLng = +markers[0].Lng;
                currentMinLat = currentMaxLat = +markers[0].Lat;

                for ( i = 0; i < markers.length; i++ ) {

                    marker = new google.maps.Marker({
                        position : {lat : +markers[i].Lat , lng : +markers[i].Lng},
                        title : markers[i].Name,
                        map : this.map
                    });

                    infoWindow = new google.maps.InfoWindow({
                        content : '<div><p>'+ marker.title +'</p></div>'
                    });

                    google.maps.event.addListener(marker, 'click', function (marker) {
                        return function(){
                            infoWindow.setContent('<div><p>'+ marker.title +'</p></div>');
                            infoWindow.open(map, marker);
                        }
                    }(marker));

                    // находим крайние точки маршрута, что бы в дальнейшем отцентрировать карту для выбранного маршрута
                    currentMinLat = marker.position.lat() < currentMinLat ? marker.position.lat() : currentMinLat;
                    currentMinLng = marker.position.lng() < currentMinLng ? marker.position.lng() : currentMinLng;
                    currentMaxLat = marker.position.lat() > currentMaxLat ? marker.position.lat() : currentMaxLat;
                    currentMaxLng = marker.position.lng() > currentMaxLng ? marker.position.lng() : currentMaxLng;

                    this.markers.push(marker);
                }

                // собственно центр карты выбранного маршрута
                routeCenterCoord = {
                    Lat : currentMinLat + (currentMaxLat - currentMinLat)/2,
                    Lng : currentMinLng + (currentMaxLng - currentMinLng)/2
                };

                this.map.setCenter(new google.maps.LatLng(routeCenterCoord.Lat, routeCenterCoord.Lng))

            }
            ,
            cleanMap : function(){
                if (this.markers.length != 0) {
                    for (var i in this.markers) {
                        this.markers[i].setMap(null);
                    }
                    this.markers = [];
                }
            }
        }


    });

    function basicParse(string){
        var data = string.split("\n"),
            newData = [],
            i;

        for ( i=0; i < data.length; i++ ){
            if (data[i][0] != ';'){
                newData.push(data[i]);
            }
        }

        for ( i=0; i < newData.length; i++ ){
            newData[i] = newData[i].split(";");
        }

        newData.shift();

        return newData;
    }

    // дело в том, что в файле stops.txt есть куча строк, мы по номерам остановок из routes.Stops вытягиваем по этим номерам id остановок в stops.Id
    // но по этим ID не всегда написаны имена остановок и пришлось написать функцию поиска, которая проходит по списку вверх до первого элемента с Name != ''
    function searchBusName (index) {

        if (stops[index].Name === ""){
            return searchBusName(index - 1);
        } else if (index < 0){
            return 'N/A'
        } else {
            return stops[index];
        }
    }


    function getWindowSize(){
        var windowWidth = window.innerWidth;

        return windowWidth < 1024 ?  false :  true;
    }


})();