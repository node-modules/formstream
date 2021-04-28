
1.1.1 / 2021-04-28
==================

**fixes**
  * [[`c96ba5b`](http://github.com/node-modules/formstream/commit/c96ba5bace0e96bf39770769e43d9de4271971d8)] - fix: upgrade mime to fix wrong mime type (#19) (shaozj <<shaozj@users.noreply.github.com>>)

**others**
  * [[`21918e5`](http://github.com/node-modules/formstream/commit/21918e5fc37a4cea5aae82659d39587f099e805b)] - chore: upgrade devDeps express to latest version (#15) (fengmk2 <<fengmk2@gmail.com>>)

1.1.0 / 2016-12-19
==================

  * deps: upgrade mime to latest version (#9)

1.0.0 / 2014-11-04
==================

 * fix(field): support stream.field(String, Number)
 * chore: fix links
 * chore: use npm scripts instead of Makefile
 * fix test case on node@0.8

0.0.8 / 2014-01-17 
==================

  * destroy source stream when formstream destroy()
  * add more test cases

0.0.7 / 2013-07-25 
==================

  * feature: always try to infer `Content-Length` (@xingrz)
  * doc improve

0.0.6 / 2013-07-15 
==================

  * added test cases for chaining call (@xingrz)
  * improved docs (@xingrz)
  * added chaining support (@xingrz)
  * api doc
  * fixed test causes
  * update dependencies version

0.0.5 / 2012-11-06 
==================

  * fixed stream error not catch bug

0.0.4 / 2012-11-06 
==================

  * fixed #2 support form.buffer()
  * add doc for setTotalStreamSize()

0.0.3 / 2012-11-06 
==================

  * support content-length use form.setTotalStreamSize(size)
  * update readme

0.0.2 / 2012-10-11 
==================

  * use buffer-concat support node < 0.8

0.0.1 / 2012-10-11 
==================

  * support multi streams.
  * add one stream support now.
  * Initial commit
