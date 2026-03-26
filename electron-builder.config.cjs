module.exports = {
  appId: 'com.yourcompany.dataagentfactory',
  productName: 'DataAgentFactory',
  directories: {
    buildResources: 'build',
    output: 'dist_electron'
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: '../DataFactory',
      to: 'DataFactory',
      filter: [
        'src/**/*',
        'requirements.txt',
        'README.md',
        'datafactory.db',
        '!**/.git/**',
        '!**/.idea/**',
        '!**/__pycache__/**',
        '!logs/**',
        '!output/**',
        '!tmp/**',
        '!uploads/**',
        '!workspace/**',
        '!runtime/**',
        '!*.pyc'
      ]
    }
  ],
  asar: true,
  extraMetadata: {
    main: 'electron/main.mjs'
  },
  mac: {
    icon: 'build/icon.icns',
    target: ['dir']
  }
}
