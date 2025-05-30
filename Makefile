CLOSURE_COMPILER=java -jar ./node_modules/google-closure-compiler-java/compiler.jar
CLOSURE_LIBRARY= ./node_modules/google-closure-library/closure

COMPILER_ARGS=--js $(SOURCES) --externs $(EXTERN) --output_wrapper "(function() {%output%})();" --dependency_mode=PRUNE_LEGACY --language_out ECMASCRIPT_2015 --entry_point apparition_instance
COMPILER_MIN_ARGS=--compilation_level ADVANCED_OPTIMIZATIONS --language_out ECMASCRIPT_2015

COMPILER_DEBUG_ARGS=--formatting=print_input_delimiter --formatting=pretty_print --warning_level=VERBOSE
COMPILER_DEV_ARGS=
KEY_VALUE=


SOURCES=$(CLOSURE_LIBRARY)/goog/base.js\
$(CLOSURE_LIBRARY)/goog/json/json.js\
src/0_config.js\
src/0_jsonparse.js\
src/0_queue.js\
src/1_utils.js\
src/2_resources.js src/2_session.js src/2_storage.js\
src/3_api.js src/3_banner_utils.js\
src/4_banner_css.js src/4_banner_html.js\
src/5_banner.js\
src/6_apparition.js\
src/7_initialization.js\
src/apparition_view.js\
src/journeys_utils.js

EXTERN=src/extern.js

VERSION=$(shell grep "version" package.json | perl -pe 's/\s+"version": "(.*)",/$$1/')

ONPAGE_RELEASE=$(subst ",\",$(shell perl -pe 'BEGIN{$$sub="https://cdn.apparition.link/apparition-latest.min.js"};s\#SCRIPT_URL_HERE\#$$sub\#' src/onpage.js | $(CLOSURE_COMPILER) | node transform.js apparition_sdk))
ONPAGE_DEV=$(subst ",\",$(shell perl -pe 'BEGIN{$$sub="build.js"};s\#SCRIPT_URL_HERE\#$$sub\#' src/onpage.js | $(CLOSURE_COMPILER) | node transform.js apparition_sdk))
ONPAGE_TEST=$(subst ",\",$(shell perl -pe 'BEGIN{$$sub="../dist/build.js"};s\#SCRIPT_URL_HERE\#$$sub\#' src/onpage.js | $(CLOSURE_COMPILER) | node transform.js apparition_sdk))

.PHONY: clean

all: dist/build.min.js dist/build.js
clean:
	rm -f dist/** docs/web/3_apparition_web.md test/apparition-deps.js dist/build.min.js.gz test/integration-test.html
release: clean all dist/build.min.js.gz


dist/build.js: $(SOURCES) $(EXTERN)
	mkdir -p dist && \
	$(CLOSURE_COMPILER) $(COMPILER_ARGS) $(COMPILER_DEBUG_ARGS) > dist/build.js

dist/build.min.js: $(SOURCES) $(EXTERN)
	mkdir -p dist && \
	$(CLOSURE_COMPILER) $(COMPILER_ARGS) $(COMPILER_MIN_ARGS) > dist/build.min.js

dist/build.min.js.gz: dist/build.min.js
	mkdir -p dist && \
	gzip -c dist/build.min.js > dist/build.min.js.gz
