'use strict';

// import plugins       from 'gulp-load-plugins';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const plugins = require('gulp-load-plugins')();
import yargs         from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import browser       from 'browser-sync';
import gulp          from 'gulp';
// import rimraf        from 'rimraf';
const rimraf = require('rimraf');
import yaml          from 'js-yaml';
import fs            from 'fs';
import dateFormat    from 'dateformat';
import webpackStream from 'webpack-stream';
import webpack2      from 'webpack';
import named         from 'vinyl-named';
import log           from 'fancy-log';
import colors        from 'ansi-colors';
const gulpSass = require('gulp-sass')(require('sass'));
import gulpAutoprefixer from 'gulp-autoprefixer';
import gulpRev from 'gulp-rev';
import imagemin from 'gulp-imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminSvgo from 'imagemin-svgo';
import zip from 'gulp-zip';

// Load all Gulp plugins into one variable
// const $ = plugins();
const $ = plugins;

// Check for --production flag
// const PRODUCTION = !!(yargs.argv.production);
const argv = yargs(hideBin(process.argv)).argv;

// Check for --production flag
const PRODUCTION = !!argv.production;

// Check for --development flag unminified with sourcemaps
const DEV = !!argv.dev;

// Check for --development flag unminified with sourcemaps
// const DEV = !!(yargs.argv.dev);

// Load settings from settings.yml
const { BROWSERSYNC, COMPATIBILITY, REVISIONING, PATHS } = loadConfig();

// Check if file exists synchronously
function checkFileExists(filepath) {
  let flag = true;
  try {
    fs.accessSync(filepath, fs.F_OK);
  } catch(e) {
    flag = false;
  }
  return flag;
}

// Load default or custom YML config file
function loadConfig() {
  log('Loading config file...');

  if (checkFileExists('config.yml')) {
    // config.yml exists, load it
    log(colors.bold(colors.cyan('config.yml')), 'exists, loading', colors.bold(colors.cyan('config.yml')));
    let ymlFile = fs.readFileSync('config.yml', 'utf8');
    return yaml.load(ymlFile);

  } else if(checkFileExists('config-default.yml')) {
    // config-default.yml exists, load it
    log(colors.bold(colors.cyan('config.yml')), 'does not exist, loading', colors.bold(colors.cyan('config-default.yml')));
    let ymlFile = fs.readFileSync('config-default.yml', 'utf8');
    return yaml.load(ymlFile);

  } else {
    // Exit if config.yml & config-default.yml do not exist
    log('Exiting process, no config file exists.');
    log('Error Code:', err.code);
    process.exit(1);
  }
}

// Delete the "dist" folder
// This happens every time a build starts
// function clean(done) {
//   rimraf(PATHS.dist, done);
// }

function clean(done) {
  fs.rm(PATHS.dist, { recursive: true, force: true }, done);
}

// Copy files out of the assets folder
// This task skips over the "images", "js", and "scss" folders, which are parsed separately
function copy() {
  return gulp.src(PATHS.assets)
    .pipe(gulp.dest(PATHS.dist + '/assets'));
}

// Compile Sass into CSS
// In production, the CSS is compressed
// function sass() {
//   return gulp.src(['src/assets/scss/app.scss','src/assets/scss/editor.scss'])
//     .pipe($.sourcemaps.init())
//     .pipe($.sass({
//       includePaths: PATHS.sass
//     })
//       .on('error', $.sass.logError))
//     .pipe($.autoprefixer({
//       browsers: COMPATIBILITY
//     }))

//     .pipe($.if(PRODUCTION, $.cleanCss({ compatibility: 'ie9' })))
//     .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
//     .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, $.rev()))
//     .pipe(gulp.dest(PATHS.dist + '/assets/css'))
//     .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, $.rev.manifest()))
//     .pipe(gulp.dest(PATHS.dist + '/assets/css'))
//     .pipe(browser.reload({ stream: true }));
// }
function sass() {
  return gulp.src(['src/assets/scss/app.scss','src/assets/scss/editor.scss'])
    .pipe($.sourcemaps.init())
    .pipe(gulpSass({
      includePaths: PATHS.sass
    }).on('error', gulpSass.logError))
    .pipe(gulpAutoprefixer({
      overrideBrowserslist: COMPATIBILITY
    }))
    .pipe($.if(PRODUCTION, $.cleanCss({ compatibility: 'ie9' })))
    .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
    .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, gulpRev()))
    .pipe(gulp.dest(PATHS.dist + '/assets/css'))
    .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, gulpRev.manifest()))
    .pipe(gulp.dest(PATHS.dist + '/assets/css'))
    .pipe(browser.reload({ stream: true }));
}

// Update the webpack build task
function webpackBuild() {
  return gulp.src(PATHS.entries)
    .pipe(named())
    .pipe(webpackStream(webpack.config, webpack2))
    .pipe($.if(PRODUCTION, $.uglify().on('error', e => { console.log(e); })))
    .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, gulpRev()))
    .pipe(gulp.dest(PATHS.dist + '/assets/js'))
    .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, gulpRev.manifest()))
    .pipe(gulp.dest(PATHS.dist + '/assets/js'));
}

// Combine JavaScript into one file
// In production, the file is minified
const webpack = {
  config: {
    module: {
      rules: [
        {
          test: /.js$/,
          loader: 'babel-loader',
          exclude: /node_modules(?![\\\/]foundation-sites)/,
        },
      ],
    },
    externals: {
      jquery: 'jQuery',
    },
  },

  changeHandler(err, stats) {
    log('[webpack]', stats.toString({
      colors: true,
    }));

    browser.reload();
  },

  build() {
    return gulp.src(PATHS.entries)
      .pipe(named())
      .pipe(webpackStream(webpack.config, webpack2))
      .pipe($.if(PRODUCTION, $.uglify()
        .on('error', e => { console.log(e); }),
      ))
      .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, $.rev()))
      .pipe(gulp.dest(PATHS.dist + '/assets/js'))
      .pipe($.if(REVISIONING && PRODUCTION || REVISIONING && DEV, $.rev.manifest()))
      .pipe(gulp.dest(PATHS.dist + '/assets/js'));
  },

  

  watch() {
    const watchConfig = Object.assign(webpack.config, {
      watch: true,
      devtool: 'inline-source-map',
    });

    return gulp.src(PATHS.entries)
      .pipe(named())
      .pipe(webpackStream(watchConfig, webpack2, webpack.changeHandler)
        .on('error', (err) => {
          log('[webpack:error]', err.toString({
            colors: true,
          }));
        }),
      )
      .pipe(gulp.dest(PATHS.dist + '/assets/js'));
  },
};

// gulp.task('webpack:build', webpack.build);
gulp.task('webpack:build', webpackBuild);
gulp.task('webpack:watch', webpack.watch);

// Copy images to the "dist" folder
// In production, the images are compressed
function images_old() {
  return gulp.src('src/assets/images/**/*')
    .pipe($.if(PRODUCTION, $.imagemin([
      $.imagemin.jpegtran({
        progressive: true,
      }),
      $.imagemin.optipng({
        optimizationLevel: 5,
      }),
			$.imagemin.gifsicle({
        interlaced: true,
      }),
			$.imagemin.svgo({
        plugins: [
          {cleanupAttrs: true},
          {removeComments: true},
        ]
      })
		])))
    .pipe(gulp.dest(PATHS.dist + '/assets/images'));
}

function images() {
  return gulp.src('src/assets/images/**/*')
    .pipe($.if(PRODUCTION, imagemin([
      imageminMozjpeg({ progressive: true }),
      imageminPngquant({ quality: [0.6, 0.8] }),
      imageminGifsicle({ interlaced: true }),
      imageminSvgo({
        plugins: [
          { name: 'removeViewBox', active: false },
          // { name: 'cleanupIDs', active: false }
        ]
      })
    ])))
    .pipe(gulp.dest(PATHS.dist + '/assets/images'));
}

// Create a .zip archive of the theme
// function archive() {
//   var time = dateFormat(new Date(), "yyyy-mm-dd_HH-MM");
//   var pkg = JSON.parse(fs.readFileSync('./package.json'));
//   var title = pkg.name + '_' + time + '.zip';

//   return gulp.src(PATHS.package)
//     .pipe($.zip(title))
//     .pipe(gulp.dest('packaged'));
// }
// Create a .zip archive of the theme
function archive() {
  var time = dateFormat(new Date(), "yyyy-mm-dd_HH-MM");
  var pkg = JSON.parse(fs.readFileSync('./package.json'));
  var title = pkg.name + '_' + time + '.zip';

  return gulp.src(PATHS.package)
    .pipe(zip(title))
    .pipe(gulp.dest('packaged'));
}

// PHP Code Sniffer task
gulp.task('phpcs', function() {
  return gulp.src(PATHS.phpcs)
    .pipe($.phpcs({
      bin: 'wpcs/vendor/bin/phpcs',
      standard: './codesniffer.ruleset.xml',
      showSniffCode: true,
    }))
    .pipe($.phpcs.reporter('log'));
});

// PHP Code Beautifier task
gulp.task('phpcbf', function () {
  return gulp.src(PATHS.phpcs)
  .pipe($.phpcbf({
    bin: 'wpcs/vendor/bin/phpcbf',
    standard: './codesniffer.ruleset.xml',
    warningSeverity: 0
  }))
  .on('error', log)
  .pipe(gulp.dest('.'));
});

// Start BrowserSync to preview the site in
function server(done) {
  browser.init({
    proxy: BROWSERSYNC.url,

    ui: {
      port: 8080
    },

  });
  done();
}

// Reload the browser with BrowserSync
function reload(done) {
  browser.reload();
  done();
}

// Watch for changes to static assets, pages, Sass, and JavaScript
function watch() {
  gulp.watch(PATHS.assets, copy);
  gulp.watch('src/assets/scss/**/*.scss', sass)
    .on('change', path => log('File ' + colors.bold(colors.magenta(path)) + ' changed.'))
    .on('unlink', path => log('File ' + colors.bold(colors.magenta(path)) + ' was removed.'));
  gulp.watch('**/*.php', reload)
    .on('change', path => log('File ' + colors.bold(colors.magenta(path)) + ' changed.'))
    .on('unlink', path => log('File ' + colors.bold(colors.magenta(path)) + ' was removed.'));
  gulp.watch('src/assets/images/**/*', gulp.series(images, reload));
}

// Build the "dist" folder by running all of the below tasks
gulp.task('build',
  gulp.series(clean, gulp.parallel(sass, 'webpack:build', images, copy)));

// Build the site, run the server, and watch for file changes
gulp.task('default',
  gulp.series('build', server, gulp.parallel('webpack:watch', watch)));

// Package task
gulp.task('package',
  gulp.series('build', archive));

gulp.task('images', images);  

// function archive() {
//   return gulp.src('dist/**/*')
//     .pipe(zip('archive.zip'))
//     .pipe(gulp.dest('dist'));
// }

gulp.task('archive', archive);
