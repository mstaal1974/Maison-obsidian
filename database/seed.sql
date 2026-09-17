INSERT INTO taxonomy_terms(vocabulary,slug,label) VALUES
('family','woody','Woody'),('family','floral','Floral'),('family','amber','Amber'),('family','fresh','Fresh'),
('season','spring','Spring'),('season','summer','Summer'),('season','autumn','Autumn'),('season','winter','Winter'),
('weather','hot','Hot'),('weather','cold','Cold'),('weather','rainy','Rainy'),
('occasion','office','Office'),('occasion','evening','Evening'),('occasion','formal','Formal'),('occasion','casual','Casual'),
('mood','confident','Confident'),('mood','calm','Calm'),('mood','sensual','Sensual'),
('gender','unisex','Unisex'),('gender','feminine','Feminine'),('gender','masculine','Masculine'),
('projection','intimate','Intimate'),('projection','moderate','Moderate'),('projection','strong','Strong'),
('longevity','short','Short'),('longevity','moderate','Moderate'),('longevity','long','Long'),
('luxury','accessible','Accessible'),('luxury','premium','Premium'),('luxury','haute','Haute')
ON CONFLICT DO NOTHING;
