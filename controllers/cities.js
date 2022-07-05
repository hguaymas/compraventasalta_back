var City = require('../models/city');
var Ad = require('../models/ad');
var cities = require('../data/ubicaciones.json');
var ObjectId = require('mongoose').Types.ObjectId;

exports.createCity = function(req, res, next) {

    var city = new City({
        name: req.body.name
    });

    city.save(function(err, result) {
        if (err) {
            return res.status(500).json({
                title: 'Ocurrió un error guardando la subcategoría',
                error: err
            });
        }
        res.status(201).json({
            city: 'Se ha creado la subcategoría exitosamente',
            obj: result
        });
    });


};



exports.listCities = function(req, res, next) {
    City.find({})
        .sort({ name: 1 })
        .exec(function(err, cities) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener ciudades',
                    error: err
                });
            }
            res.status(200).json(cities)
        });
};

exports.listCitiesCountAds = function (req, res, next) {
    const category = req.query.category;
    const subcategory = req.query.subcategory;
    var arrayAggregate = [];
    var match = {
        enabled: true,
        status: {
            $in: ["ACTIVE", "PENDING"]
        }
    };
    if(category) {
        match.category = ObjectId(category);
        arrayAggregate.push({
            "$match": match
        });
    }
    if(subcategory) {
        match.subcategory = ObjectId(subcategory);
        arrayAggregate.push({
            "$match": match
        });
    }
    arrayAggregate.push({"$group": {_id:"$city", count:{$sum:1}}});
    arrayAggregate.push({"$sort": {"count":-1}});
    ;
    console.log(arrayAggregate);
    Ad.aggregate(arrayAggregate).exec(function(err, ads) {
        if (err) {
            console.log(err);
        }
        console.log(ads);
        City.populate(ads, {path: '_id'}, function(err, ads2) {
            if (err) {
                console.log(err);
            }
            res.status(200).json(ads2)
        })

    });
}

exports.updateCity = function(req, res, next) {
    City.findByIdAndUpdate(req.params.id, function(err, city) {
        if (err) {
            return res.status(500).json({
                title: 'An error ocurred',
                error: err
            });
        }
        if (!city) {
            return res.status(500).json({
                title: 'No se encontró la Subcategoría!',
                error: {message: 'Subcategoría no encontrada'}
            });
        } else {
            res.status(200).json({
                city: 'Subcategoría actualizada',
                obj: city
            });
        }
    });
};

exports.deleteCity = function(req, res, next) {

};


exports.insertCities = function (req, res, next) {
    City.remove({}, function (err) {
        if (err) {
            return res.status(500).json({
                title: 'Ocurrió un error eliminando las Ciudades',
                error: err
            });
        }
        cities.forEach(function (c, index) {
            var city = new City();
            city.name = c.nombre;
            city.save();
        });

        return res.status(201).json({
            message: 'Ciudades creadas exitosamente.'
        });
    });
};

exports.getCityBySlug = async (req, res, next) => {
    const citySlug = req.params.slug;
    try {
        let city = await City.findOne({slug: citySlug});
        res.status(200).json(city);

    } catch(err) {
        return res.status(500).json({
            title: 'Error al obtener la ciudad "' + citySlug + '"',
            error: err
        });
    }
};
   
