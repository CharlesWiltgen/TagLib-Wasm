# Install script for directory: /Users/Charles/Projects/taglib-wasm/lib/taglib/taglib

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/opt/homebrew/Cellar/emscripten/4.0.12/libexec/cache/sysroot")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Release")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "TRUE")
endif()

# Set path to fallback-tool for dependency-resolution.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "/usr/bin/objdump")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib/libtag.a")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/taglib" TYPE FILE FILES
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/tag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/fileref.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/audioproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/taglib_export.h"
    "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib/../taglib_config.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/taglib.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tstring.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tlist.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tlist.tcc"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tstringlist.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tbytevector.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tbytevectorlist.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tvariant.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tbytevectorstream.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tiostream.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tfilestream.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tmap.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tmap.tcc"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tpicturetype.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tpropertymap.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tdebuglistener.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/toolkit/tversionnumber.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/mpegfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/mpegproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/mpegheader.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/xingheader.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v1/id3v1tag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v1/id3v1genres.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2extendedheader.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2frame.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2header.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2synchdata.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2footer.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2framefactory.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/id3v2tag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/attachedpictureframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/commentsframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/eventtimingcodesframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/generalencapsulatedobjectframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/ownershipframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/popularimeterframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/privateframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/relativevolumeframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/synchronizedlyricsframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/textidentificationframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/uniquefileidentifierframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/unknownframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/unsynchronizedlyricsframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/urllinkframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/chapterframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/tableofcontentsframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpeg/id3v2/frames/podcastframe.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/oggfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/oggpage.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/oggpageheader.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/xiphcomment.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/vorbis/vorbisfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/vorbis/vorbisproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/flac/oggflacfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/speex/speexfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/speex/speexproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/opus/opusfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ogg/opus/opusproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/flac/flacfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/flac/flacpicture.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/flac/flacproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/flac/flacmetadatablock.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ape/apefile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ape/apeproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ape/apetag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ape/apefooter.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/ape/apeitem.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpc/mpcfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mpc/mpcproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/wavpack/wavpackfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/wavpack/wavpackproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/trueaudio/trueaudiofile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/trueaudio/trueaudioproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/riff/rifffile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/riff/aiff/aifffile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/riff/aiff/aiffproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/riff/wav/wavfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/riff/wav/wavproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/riff/wav/infotag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/asf/asffile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/asf/asfproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/asf/asftag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/asf/asfattribute.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/asf/asfpicture.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4file.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4atom.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4tag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4item.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4properties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4coverart.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mp4/mp4itemfactory.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mod/modfilebase.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mod/modfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mod/modtag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/mod/modproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/it/itfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/it/itproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/s3m/s3mfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/s3m/s3mproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/xm/xmfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/xm/xmproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/dsf/dsffile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/dsf/dsfproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/dsdiff/dsdifffile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/dsdiff/dsdiffproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/dsdiff/dsdiffdiintag.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/shorten/shortenfile.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/shorten/shortenproperties.h"
    "/Users/Charles/Projects/taglib-wasm/lib/taglib/taglib/shorten/shortentag.h"
    )
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib/taglib-targets.cmake")
    file(DIFFERENT _cmake_export_file_changed FILES
         "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib/taglib-targets.cmake"
         "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib/CMakeFiles/Export/398eef5e047a0959864f2888198961bf/taglib-targets.cmake")
    if(_cmake_export_file_changed)
      file(GLOB _cmake_old_config_files "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib/taglib-targets-*.cmake")
      if(_cmake_old_config_files)
        string(REPLACE ";" ", " _cmake_old_config_files_text "${_cmake_old_config_files}")
        message(STATUS "Old export file \"$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib/taglib-targets.cmake\" will be replaced.  Removing files [${_cmake_old_config_files_text}].")
        unset(_cmake_old_config_files_text)
        file(REMOVE ${_cmake_old_config_files})
      endif()
      unset(_cmake_old_config_files)
    endif()
    unset(_cmake_export_file_changed)
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib" TYPE FILE FILES "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib/CMakeFiles/Export/398eef5e047a0959864f2888198961bf/taglib-targets.cmake")
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib" TYPE FILE FILES "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib/CMakeFiles/Export/398eef5e047a0959864f2888198961bf/taglib-targets-release.cmake")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/taglib" TYPE FILE FILES
    "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib-config.cmake"
    "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib-config-version.cmake"
    )
endif()

string(REPLACE ";" "\n" CMAKE_INSTALL_MANIFEST_CONTENT
       "${CMAKE_INSTALL_MANIFEST_FILES}")
if(CMAKE_INSTALL_LOCAL_ONLY)
  file(WRITE "/Users/Charles/Projects/taglib-wasm/build/emscripten/taglib/taglib/install_local_manifest.txt"
     "${CMAKE_INSTALL_MANIFEST_CONTENT}")
endif()
