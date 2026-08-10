// TEMP-VERIFY: reintroduced violation for CI gate verification (taglib-evmk).
// Never compiled (build/build-wasi.sh uses an explicit source list); the
// cpp-fileref-takes-ownership rule must flag this on the lint:ast CI step.
// DELETE before merge.
#include <memory>

struct VerifyProbe {
  void probe() {
    std::unique_ptr<int> file;
    TagLib::FileRef ref(file.get());
  }
};
