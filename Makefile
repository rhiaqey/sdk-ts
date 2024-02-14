.PHONY: build
build:
	npm run build

.PHONY: prod
prod: build
	npm pack

.PHONY: test
test:
	npm run test

.PHONY: serve
serve: build
	npm run serve
