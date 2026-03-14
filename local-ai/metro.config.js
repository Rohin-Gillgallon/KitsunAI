const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith('three/examples/jsm/loaders/') && !moduleName.endsWith('.js')) {
        return context.resolveRequest(context, moduleName + '.js', platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = config.resolver.sourceExts.filter(
    ext => ext !== 'sql'
);

module.exports = config;
