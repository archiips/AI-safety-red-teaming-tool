cmake_minimum_required(VERSION 3.15)
project(crucible_policy CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find pybind11
find_package(pybind11 REQUIRED)

# Find RE2 — prefer CMake config (Homebrew/vcpkg), fall back to pkg-config (Debian)
find_package(re2 QUIET)
if(NOT re2_FOUND)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(RE2 REQUIRED re2)
    add_library(re2::re2 INTERFACE IMPORTED)
    target_include_directories(re2::re2 INTERFACE ${RE2_INCLUDE_DIRS})
    target_link_libraries(re2::re2 INTERFACE ${RE2_LINK_LIBRARIES})
endif()

# Find ICU for unicode normalization
find_package(ICU COMPONENTS uc i18n QUIET)

include_directories(${CMAKE_SOURCE_DIR}/include)

pybind11_add_module(crucible_policy
    src/bindings.cpp
    src/severity.cpp
    src/aho_corasick.cpp
    src/unicode_norm.cpp
)

target_link_libraries(crucible_policy PRIVATE re2::re2)

if(ICU_FOUND)
    target_link_libraries(crucible_policy PRIVATE ICU::uc ICU::i18n)
    target_compile_definitions(crucible_policy PRIVATE HAVE_ICU=1)
endif()

# Output the .so directly into the project root so Python can import it
set_target_properties(crucible_policy PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/..
)
