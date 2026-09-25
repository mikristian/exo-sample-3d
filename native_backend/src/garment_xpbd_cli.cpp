#include <algorithm>
#include <cstdint>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <regex>
#include <set>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "PositionBasedDynamics/XPBD.h"
#include "PositionBasedDynamics/PositionBasedDynamics.h"
#include "json/json.hpp"

using json = nlohmann::json;

struct Particle {
    std::string id;
    std::string pieceId;
    Vector3r position;
    Vector3r previous;
    Real invMass = 1.0;
    std::string wrapMode;
    Real patternU = 1.0;
    Real collisionSideZ = 0.0;
    Real constructionSideZ = 0.0;
    bool seamBoundary = false;
    std::vector<std::string> seamIds;
    Real thickness = 0.002;
    Real friction = 0.3;
    Real contactDepth = 0.0;
    int layerIndex = 0;
};

struct Constraint {
    std::string type;
    int a = -1;
    int b = -1;
    Real rest = 0.0;
    Real stiffness = 100000.0;
    Real lambda = 0.0;
    std::string seamId;
};

struct Anchor {
    int particle = -1;
    Vector3r target = Vector3r::Zero();
    Real stiffness = 0.2;
    bool axisX = true;
    bool axisY = true;
    bool axisZ = true;
};

struct StrainTriangle {
    int a = -1;
    int b = -1;
    int c = -1;
    Matrix2r invRestMat = Matrix2r::Identity();
    Real xxStiffness = 0.8;
    Real yyStiffness = 0.8;
    Real xyStiffness = 0.5;
};

struct IsometricBend {
    int p0 = -1;
    int p1 = -1;
    int p2 = -1;
    int p3 = -1;
    Matrix4r Q = Matrix4r::Zero();
    Real stiffness = 0.01;
    Real lambda = 0.0;
};

struct Avatar {
    Real heightScale = 1.0;
    Real chestScale = 1.0;
    Real waistScale = 1.0;
    Real hipScale = 1.0;
    Real shoulderHalfWidth = 0.23;
    Real shoulderCapRadiusX = 0.24;
    Real shoulderCapRadiusY = 0.15;
    Real shoulderCapRadiusZ = 0.135;
    Real shoulderCenterY = 1.57;
    Real shoulderJointY = 1.54;
    Real neckRadius = 0.075;
    Real neckRadiusY = 0.14;
    Real neckCenterY = 1.72;
    Real armRadius = 0.065;
    Real armHalfLength = 0.36;
    Real armAngleRad = 0.104719755;
};

struct ArmPose {
    Vector3r center = Vector3r::Zero();
    Vector3r axis = Vector3r(0, 1, 0);
    Real halfLength = 0.36;
    Real radius = 0.065;
};

struct CellKey {
    int x = 0;
    int y = 0;
    int z = 0;
    bool operator==(const CellKey &other) const {
        return x == other.x && y == other.y && z == other.z;
    }
};

struct CellKeyHash {
    std::size_t operator()(const CellKey &key) const {
        std::size_t seed = std::hash<int>{}(key.x);
        seed ^= std::hash<int>{}(key.y) + 0x9e3779b9 + (seed << 6) + (seed >> 2);
        seed ^= std::hash<int>{}(key.z) + 0x9e3779b9 + (seed << 6) + (seed >> 2);
        return seed;
    }
};

template <typename T>
static T clampValue(T value, T low, T high) {
    return std::max(low, std::min(high, value));
}

static Vector3r vec3(const json &value) {
    return Vector3r(
        value.at(0).get<Real>(),
        value.at(1).get<Real>(),
        value.at(2).get<Real>()
    );
}

static json jsonVec(const Vector3r &v) {
    return json::array({v.x(), v.y(), v.z()});
}

static std::string stringValue(const json &object, const char *key, const std::string &fallback = "") {
    const auto it = object.find(key);
    if (it == object.end() || it->is_null() || !it->is_string()) return fallback;
    return it->get<std::string>();
}

static Real numberValue(const json &object, const char *key, Real fallback) {
    const auto it = object.find(key);
    if (it == object.end() || it->is_null() || !it->is_number()) return fallback;
    return it->get<Real>();
}

static bool boolValue(const json &object, const char *key, bool fallback) {
    const auto it = object.find(key);
    if (it == object.end() || it->is_null() || !it->is_boolean()) return fallback;
    return it->get<bool>();
}

static Avatar avatarFromJson(const json &value) {
    Avatar avatar;
    const Real heightCm = numberValue(value, "heightCm", 180.0);
    avatar.heightScale = clampValue(heightCm / 180.0, Real(0.78), Real(1.22));
    avatar.chestScale = clampValue(numberValue(value, "chestCm", 96.0) / 96.0, Real(0.72), Real(1.42));
    avatar.waistScale = clampValue(numberValue(value, "waistCm", 78.0) / 78.0, Real(0.68), Real(1.50));
    avatar.hipScale = clampValue(numberValue(value, "hipCm", 94.0) / 94.0, Real(0.72), Real(1.42));
    const Real shoulderWidthCm = clampValue(numberValue(value, "shoulderWidthCm", 46.0), Real(34.0), Real(62.0));
    const Real neckCm = clampValue(numberValue(value, "neckCm", 38.0), Real(28.0), Real(58.0));
    const Real bicepCm = clampValue(numberValue(value, "bicepCm", 32.0), Real(20.0), Real(60.0));
    const Real armLengthCm = clampValue(numberValue(value, "armLengthCm", 72.0 * avatar.heightScale), Real(42.0), Real(86.0));
    avatar.shoulderHalfWidth = shoulderWidthCm * 0.005;
    avatar.shoulderCapRadiusX = avatar.shoulderHalfWidth + 0.01;
    avatar.shoulderCapRadiusY = 0.15 * avatar.heightScale;
    avatar.shoulderCapRadiusZ = 0.135 * avatar.chestScale;
    avatar.shoulderCenterY = 1.57 * avatar.heightScale;
    avatar.shoulderJointY = 1.54 * avatar.heightScale;
    avatar.neckRadius = 0.075 * (neckCm / 38.0);
    avatar.neckRadiusY = 0.14 * avatar.heightScale;
    avatar.neckCenterY = 1.72 * avatar.heightScale;
    avatar.armRadius = 0.065 * (bicepCm / 32.0);
    avatar.armHalfLength = armLengthCm * 0.005;
    avatar.armAngleRad = clampValue(numberValue(value, "armAngleDeg", 6.0), Real(0.0), Real(80.0)) * Real(M_PI / 180.0);
    return avatar;
}

static ArmPose armPose(const Avatar &avatar, int side) {
    const Real safeSide = side < 0 ? -1.0 : 1.0;
    const Real rotationZ = safeSide * avatar.armAngleRad;
    ArmPose pose;
    pose.axis = Vector3r(-std::sin(rotationZ), std::cos(rotationZ), 0.0).normalized();
    const Vector3r shoulderJoint(
        safeSide * (avatar.shoulderHalfWidth + avatar.armRadius * 0.26),
        avatar.shoulderJointY,
        0.0
    );
    pose.halfLength = avatar.armHalfLength;
    pose.radius = avatar.armRadius;
    pose.center = shoulderJoint - pose.axis * pose.halfLength;
    return pose;
}

static Vector2r torsoRadii(const Avatar &avatar, Real worldY) {
    const Real y = worldY / avatar.heightScale;
    if (y >= 1.45) {
        const Real shoulderBulge = std::max(Real(0.0), Real(1.0) - std::abs(y - 1.57) / 0.18);
        return Vector2r((0.19 + 0.05 * shoulderBulge) * avatar.chestScale, (0.13 + 0.012 * shoulderBulge) * avatar.chestScale);
    }
    if (y >= 1.08) {
        const Real t = clampValue((y - 1.08) / 0.5, Real(0.0), Real(1.0));
        return Vector2r(
            (1.0 - t) * 0.155 * avatar.waistScale + t * 0.19 * avatar.chestScale,
            (1.0 - t) * 0.105 * avatar.waistScale + t * 0.13 * avatar.chestScale
        );
    }
    const Real t = clampValue((y - 0.60) / 0.48, Real(0.0), Real(1.0));
    return Vector2r(
        (1.0 - t) * 0.20 * avatar.hipScale + t * 0.155 * avatar.waistScale,
        (1.0 - t) * 0.14 * avatar.hipScale + t * 0.105 * avatar.waistScale
    );
}

static bool hasSeamToken(const Particle &particle, const std::vector<std::string> &tokens) {
    for (const auto &id : particle.seamIds) {
        for (const auto &token : tokens) if (id.find(token) != std::string::npos) return true;
    }
    return false;
}

static void frictionSync(Particle &particle, const Vector3r &target, Real factor) {
    particle.previous += (target - particle.previous) * clampValue(factor, Real(0.0), Real(0.2));
}

static void collideEllipsoid(Particle &particle, const Vector3r &center, const Vector3r &radii, Real margin) {
    if (particle.invMass <= 0.0) return;
    const Vector3r delta = particle.position - center;
    const Vector3r expanded = radii + Vector3r::Constant(margin);
    const Real q = delta.x() * delta.x() / (expanded.x() * expanded.x()) +
                   delta.y() * delta.y() / (expanded.y() * expanded.y()) +
                   delta.z() * delta.z() / (expanded.z() * expanded.z());
    if (q >= 1.0 || q <= 1e-9) return;
    const Real normalizedRadius = std::sqrt(q);
    particle.contactDepth = std::max(
        particle.contactDepth,
        (Real(1.0) - normalizedRadius) * std::min({expanded.x(), expanded.y(), expanded.z()})
    );
    const Real scale = 1.0 / std::sqrt(q);
    const Vector3r target = center + delta * scale;
    particle.position = target;
    frictionSync(particle, target, particle.friction * 0.08);
}

static void collideVerticalEllipse(Particle &particle, const Avatar &avatar, Real margin) {
    if (particle.invMass <= 0.0 || particle.position.y() < 0.56 * avatar.heightScale || particle.position.y() > 1.49 * avatar.heightScale) return;
    const Vector2r radii = torsoRadii(avatar, particle.position.y());
    const Real rx = radii.x() + margin;
    const Real rz = radii.y() + margin;
    const Real dx = particle.position.x();
    const Real dz = particle.position.z();
    const Real q = dx * dx / (rx * rx) + dz * dz / (rz * rz);
    if (q >= 1.0) return;
    particle.contactDepth = std::max(
        particle.contactDepth,
        (Real(1.0) - std::sqrt(std::max(q, Real(0.0)))) * std::min(rx, rz)
    );
    const Real patternAbs = std::abs(particle.patternU);
    const bool torsoPanel = particle.wrapMode == "front" || particle.wrapMode == "back";
    const Real baseBodyY = particle.position.y() / std::max(Real(0.001), avatar.heightScale);
    const bool torsoSideSeam = hasSeamToken(particle, {"side-l", "side-r", "side seam", "seam-side"});
    const bool lowerTorsoSideLock = torsoPanel && baseBodyY < 1.54 && !torsoSideSeam;
    const bool legPanel = particle.wrapMode == "left-leg-front" || particle.wrapMode == "left-leg-back" || particle.wrapMode == "right-leg-front" || particle.wrapMode == "right-leg-back";
    const bool lowerInnerSeam = legPanel && hasSeamToken(particle, {"inseam", "rise"}) && particle.position.y() > 0.54 * avatar.heightScale;
    const bool lowerPanel = particle.wrapMode == "lower-front" || particle.wrapMode == "lower-back" || legPanel;
    const bool preferFrontBack = (torsoPanel && (patternAbs < 0.78 || lowerTorsoSideLock)) || (lowerPanel && (!particle.seamBoundary || lowerInnerSeam) && patternAbs < 0.92);
    Vector3r target = particle.position;
    if (q <= 1e-9 || preferFrontBack) {
        Real sideZ = particle.collisionSideZ;
        if (std::abs(sideZ) < 1e-6) sideZ = particle.previous.z() >= 0 ? 1.0 : -1.0;
        target.z() = (sideZ >= 0 ? 1.0 : -1.0) * rz;
    } else {
        const Real scale = 1.0 / std::sqrt(std::max(q, Real(1e-9)));
        target.x() = dx * scale;
        target.z() = dz * scale;
    }
    particle.position = target;
    particle.previous.x() += (target.x() - particle.previous.x()) * std::min(Real(0.2), particle.friction * 0.12);
    particle.previous.z() += (target.z() - particle.previous.z()) * std::min(Real(0.2), particle.friction * 0.12);
}

static void collideCapsule(Particle &particle, const ArmPose &pose, Real margin) {
    if (particle.invMass <= 0.0) return;
    const Vector3r start = pose.center - pose.axis * pose.halfLength;
    const Vector3r end = pose.center + pose.axis * pose.halfLength;
    const Vector3r segment = end - start;
    const Real lengthSq = std::max(Real(1e-9), segment.squaredNorm());
    const Real t = clampValue((particle.position - start).dot(segment) / lengthSq, Real(0.0), Real(1.0));
    const Vector3r closest = start + segment * t;
    Vector3r delta = particle.position - closest;
    const Real distance = delta.norm();
    const Real radius = pose.radius + margin;
    if (distance >= radius) return;
    particle.contactDepth = std::max(particle.contactDepth, radius - distance);
    if (distance <= 1e-9) delta = Vector3r(0, 0, std::abs(particle.collisionSideZ) > 1e-6 ? particle.collisionSideZ : 1.0);
    else delta /= distance;
    const Vector3r target = closest + delta * radius;
    particle.position = target;
    frictionSync(particle, target, particle.friction * 0.10);
}

static void collideAvatar(Particle &particle, const Avatar &avatar, Real baseMargin) {
    const Real layerOffset = particle.layerIndex * std::max(Real(0.0025), particle.thickness * 1.15);
    const Real margin = baseMargin + particle.thickness + layerOffset;
    collideVerticalEllipse(particle, avatar, margin);
    collideEllipsoid(particle, Vector3r(0, avatar.shoulderCenterY, 0), Vector3r(avatar.shoulderCapRadiusX, avatar.shoulderCapRadiusY, avatar.shoulderCapRadiusZ), margin);
    collideCapsule(particle, armPose(avatar, -1), margin);
    collideCapsule(particle, armPose(avatar, 1), margin);
    const bool torsoCloth = particle.wrapMode == "front" || particle.wrapMode == "back";
    const bool useNeck = !torsoCloth || std::abs(particle.position.x()) < avatar.neckRadius * 0.86 || particle.position.y() > 1.735 * avatar.heightScale;
    if (useNeck) collideEllipsoid(particle, Vector3r(0, avatar.neckCenterY, 0), Vector3r(avatar.neckRadius, avatar.neckRadiusY, avatar.neckRadius), margin);
    const bool useHead = !torsoCloth || particle.position.y() > 1.755 * avatar.heightScale;
    if (useHead) collideEllipsoid(particle, Vector3r(0, 1.88 * avatar.heightScale, 0), Vector3r(0.15, 0.19 * avatar.heightScale, 0.15), margin);
    const bool ownsLeftLeg = particle.wrapMode.rfind("left-leg", 0) == 0;
    const bool ownsRightLeg = particle.wrapMode.rfind("right-leg", 0) == 0;
    const bool upperInner = (ownsLeftLeg || ownsRightLeg) && hasSeamToken(particle, {"inseam", "rise"}) && particle.position.y() > 0.54 * avatar.heightScale;
    const Vector3r legRadii(0.09, 0.48 * avatar.heightScale, 0.10);
    if (ownsLeftLeg && !upperInner) collideEllipsoid(particle, Vector3r(-0.105, 0.24 * avatar.heightScale, 0), legRadii, margin);
    else if (ownsRightLeg && !upperInner) collideEllipsoid(particle, Vector3r(0.105, 0.24 * avatar.heightScale, 0), legRadii, margin);
    else if (!ownsLeftLeg && !ownsRightLeg) {
        collideEllipsoid(particle, Vector3r(-0.105, 0.24 * avatar.heightScale, 0), legRadii, margin);
        collideEllipsoid(particle, Vector3r(0.105, 0.24 * avatar.heightScale, 0), legRadii, margin);
    }
    if (particle.position.y() < 0.01) particle.position.y() = 0.01;
}

static std::uint64_t pairKey(int a, int b) {
    const auto left = static_cast<std::uint32_t>(std::min(a, b));
    const auto right = static_cast<std::uint32_t>(std::max(a, b));
    return (static_cast<std::uint64_t>(left) << 32) | right;
}

static std::string fusedKey(const std::string &a, const std::string &b) {
    return a < b ? a + "|" + b : b + "|" + a;
}

static Vector3r outwardDirection(const Particle &particle) {
    Real centerX = 0.0;
    if (particle.wrapMode == "left-arm") centerX = -0.285;
    else if (particle.wrapMode == "right-arm") centerX = 0.285;
    else if (particle.wrapMode.rfind("left-leg", 0) == 0) centerX = -0.105;
    else if (particle.wrapMode.rfind("right-leg", 0) == 0) centerX = 0.105;
    Vector3r direction(particle.position.x() - centerX, 0.0, particle.position.z());
    if (direction.squaredNorm() <= 1e-12) direction = Vector3r(0, 0, std::abs(particle.collisionSideZ) > 1e-6 ? particle.collisionSideZ : 1.0);
    else direction.normalize();
    return direction;
}

static void resolveSelfCollisions(
    std::vector<Particle> &particles,
    Real minimumDistance,
    const std::unordered_set<std::uint64_t> &exclusions,
    const std::set<std::string> &fusedPairs
) {
    if (minimumDistance <= 1e-9) return;
    const Real cellSize = minimumDistance;
    std::unordered_map<CellKey, std::vector<int>, CellKeyHash> grid;
    grid.reserve(particles.size() * 2);
    const auto cellFor = [cellSize](const Particle &particle) {
        return CellKey{
            static_cast<int>(std::floor(particle.position.x() / cellSize)),
            static_cast<int>(std::floor(particle.position.y() / cellSize)),
            static_cast<int>(std::floor(particle.position.z() / cellSize)),
        };
    };
    for (int index = 0; index < static_cast<int>(particles.size()); ++index) grid[cellFor(particles[index])].push_back(index);

    const Real minSq = minimumDistance * minimumDistance;
    std::vector<Vector3r> corrections(particles.size(), Vector3r::Zero());
    for (int index = 0; index < static_cast<int>(particles.size()); ++index) {
        auto &particle = particles[index];
        if (particle.invMass <= 0.0) continue;
        const CellKey cell = cellFor(particle);
        for (int dx = -1; dx <= 1; ++dx) {
            for (int dy = -1; dy <= 1; ++dy) {
                for (int dz = -1; dz <= 1; ++dz) {
                    const CellKey neighbor{cell.x + dx, cell.y + dy, cell.z + dz};
                    const auto found = grid.find(neighbor);
                    if (found == grid.end()) continue;
                    for (const int otherIndex : found->second) {
                        if (otherIndex <= index) continue;
                        auto &other = particles[otherIndex];
                        if (particle.pieceId != other.pieceId && fusedPairs.count(fusedKey(particle.pieceId, other.pieceId))) continue;
                        if (exclusions.count(pairKey(index, otherIndex))) continue;

                        Vector3r delta = other.position - particle.position;
                        const Real distanceSq = delta.squaredNorm();
                        if (distanceSq >= minSq) continue;
                        const Real distance = std::sqrt(std::max(distanceSq, Real(1e-12)));
                        const int layerA = particle.layerIndex;
                        const int layerB = other.layerIndex;
                        if (layerA != layerB) {
                            const Particle &higher = layerA > layerB ? particle : other;
                            const Vector3r outward = outwardDirection(higher);
                            const Vector3r preferred = layerB > layerA ? outward : -outward;
                            if (distanceSq <= 1e-12) delta = preferred;
                            else {
                                delta /= distance;
                                if (delta.dot(preferred) < 0.65) delta = (delta * 0.18 + preferred * 0.82).normalized();
                            }
                        } else if (distanceSq <= 1e-12) delta = Vector3r(1, 0, 0);
                        else delta /= distance;

                        const Real penetration = minimumDistance - distance;
                        Real wa = particle.invMass;
                        Real wb = other.invMass;
                        if (wa + wb <= 1e-9) continue;
                        if (layerA != layerB && wa > 0 && wb > 0) {
                            if (layerA > layerB) { wa = 0.9; wb = 0.1; }
                            else { wa = 0.1; wb = 0.9; }
                        }
                        const Real total = wa + wb;
                        if (wa > 0) corrections[index] += delta * (-penetration * wa / total);
                        if (wb > 0) corrections[otherIndex] += delta * (penetration * wb / total);
                    }
                }
            }
        }
    }
    for (int index = 0; index < static_cast<int>(particles.size()); ++index) {
        if (particles[index].invMass > 0.0) particles[index].position += corrections[index];
    }
}

static void stabilizeConstructionSides(std::vector<Particle> &particles) {
    for (auto &particle : particles) {
        const Real side = particle.constructionSideZ;
        if (side != -1.0 && side != 1.0) continue;
        if (particle.position.z() * side < 0) particle.position.z() = side * std::abs(particle.position.z());
        if (particle.previous.z() * side < 0) particle.previous.z() = side * std::abs(particle.previous.z());
    }
}

static void satisfyDirectDistance(Constraint &constraint, std::vector<Particle> &particles, Real stiffness) {
    auto &a = particles[constraint.a];
    auto &b = particles[constraint.b];
    const Real wa = a.invMass;
    const Real wb = b.invMass;
    const Real total = wa + wb;
    if (total <= 1e-9) return;
    Vector3r delta = b.position - a.position;
    const Real length = delta.norm();
    if (length <= 1e-9) return;
    const Real error = (length - constraint.rest) / length;
    const Vector3r correction = delta * error * stiffness;
    if (wa > 0.0) a.position += correction * (wa / total);
    if (wb > 0.0) b.position -= correction * (wb / total);
}

static bool lowerBodyWrap(const std::string &wrapMode) {
    return wrapMode == "lower-front" || wrapMode == "lower-back" ||
           wrapMode == "left-leg-front" || wrapMode == "left-leg-back" ||
           wrapMode == "right-leg-front" || wrapMode == "right-leg-back";
}

static void stabilizeSeamPairs(std::vector<Constraint> &constraints, std::vector<Particle> &particles, const Avatar &avatar, Real collisionMargin) {
    for (auto &constraint : constraints) {
        if (constraint.type != "seam") continue;
        auto &a = particles[constraint.a];
        auto &b = particles[constraint.b];
        const Real distance = (a.position - b.position).norm();
        if (distance <= std::max(Real(0.025), constraint.rest * 2.5)) continue;

        if (lowerBodyWrap(a.wrapMode) || lowerBodyWrap(b.wrapMode)) {
            // Native XPBD distance constraints are compliance-based, while
            // the browser recovery pass is a normalized PBD projection. A
            // slightly stronger local recovery keeps trouser inseams/crotch
            // closure comparable after analytic leg collision without making
            // the primary seam solver globally stiffer.
            satisfyDirectDistance(constraint, particles, 0.92);
            continue;
        }

        const Vector3r midpoint = (a.position + b.position) * 0.5;
        Particle proxy;
        proxy.position = midpoint;
        proxy.previous = (a.previous + b.previous) * 0.5;
        proxy.invMass = 1.0;
        proxy.wrapMode = "";
        proxy.patternU = 1.0;
        proxy.collisionSideZ = std::abs(midpoint.z()) > 1e-6 ? (midpoint.z() > 0 ? 1.0 : -1.0) : (std::abs(a.collisionSideZ) > 1e-6 ? a.collisionSideZ : b.collisionSideZ);
        if (std::abs(proxy.collisionSideZ) < 1e-6) proxy.collisionSideZ = 1.0;
        proxy.thickness = std::max(a.thickness, b.thickness);
        proxy.layerIndex = std::max(a.layerIndex, b.layerIndex);
        proxy.friction = std::max(a.friction, b.friction);
        collideAvatar(proxy, avatar, collisionMargin);
        Vector3r displacement = proxy.position - midpoint;
        const Real displacementLength = displacement.norm();
        if (displacementLength > 0.04) displacement *= 0.04 / displacementLength;
        if (a.invMass > 0.0) a.position += displacement;
        if (b.invMass > 0.0) b.position += displacement;
        satisfyDirectDistance(constraint, particles, 0.995);
    }
}

int main(int argc, char **argv) {
    if (argc < 3) {
        std::cerr << "Usage: garment_xpbd_cli input.json output.json [frames]\n";
        return 2;
    }
    const std::string inputPath = argv[1];
    const std::string outputPath = argv[2];
    const int frames = argc >= 4 ? std::max(1, std::stoi(argv[3])) : 120;

    std::ifstream input(inputPath);
    if (!input) throw std::runtime_error("Cannot open input: " + inputPath);
    json request;
    input >> request;
    if (stringValue(request, "protocol") != "garment-studio.native-xpbd") {
        throw std::runtime_error("Unsupported native simulation protocol");
    }

    const json settings = request.value("settings", json::object());
    const Real gravity = settings.value("gravity", 9.81);
    const Real damping = settings.value("damping", 0.994);
    const Real dt = settings.value("dt", 1.0 / 60.0);
    const int requestedIterations = std::clamp(settings.value("iterations", 7), 2, 24);
    const int substeps = std::clamp(settings.value("substeps", 1), 1, 4);
    const int iterations = std::max(2, static_cast<int>(std::ceil(Real(requestedIterations) / Real(substeps))));
    const bool collisions = boolValue(settings, "collisions", true);
    const bool selfCollision = boolValue(settings, "selfCollision", true);
    const Real collisionMargin = numberValue(settings, "collisionMargin", 0.012);
    const Real selfCollisionMargin = numberValue(settings, "selfCollisionMargin", 0.002);
    const Real maxThickness = numberValue(settings, "maxThickness", 0.002);
    const Real structuralStiffness = clampValue(numberValue(settings, "structuralStiffness", 0.92), Real(0.05), Real(0.999));
    const std::string clothModel = stringValue(settings, "clothModel", "distance");
    const std::string bendingModel = stringValue(settings, "bendingModel", "distance");
    const Avatar avatar = avatarFromJson(request.value("avatar", json::object()));

    std::vector<Particle> particles;
    for (const auto &item : request.at("particles")) {
        Particle p;
        p.id = stringValue(item, "id");
        p.pieceId = stringValue(item, "pieceId");
        p.position = vec3(item.at("position"));
        p.previous = item.find("previous") != item.end() ? vec3(item.at("previous")) : p.position;
        p.invMass = item.value("invMass", 1.0);
        p.wrapMode = stringValue(item, "wrapMode");
        p.patternU = numberValue(item, "patternU", 1.0);
        p.collisionSideZ = numberValue(item, "collisionSideZ", 0.0);
        p.constructionSideZ = numberValue(item, "constructionSideZ", 0.0);
        p.seamBoundary = boolValue(item, "seamBoundary", false);
        p.thickness = numberValue(item, "thickness", 0.002);
        p.friction = numberValue(item, "friction", 0.3);
        p.contactDepth = 0.0;
        p.layerIndex = item.value("layerIndex", 0);
        if (item.find("seamIds") != item.end() && item.at("seamIds").is_array()) {
            for (const auto &seamId : item.at("seamIds")) if (seamId.is_string()) p.seamIds.push_back(seamId.get<std::string>());
        }
        particles.push_back(p);
    }

    std::vector<Constraint> constraints;
    for (const auto &item : request.at("constraints")) {
        Constraint c;
        c.type = item.value("type", "structural");
        c.a = item.value("a", -1);
        c.b = item.value("b", -1);
        c.rest = item.value("rest", 0.0);
        c.stiffness = item.value("stiffness", 100000.0);
        c.seamId = stringValue(item, "seamId");
        if (c.a >= 0 && c.b >= 0 && c.a < static_cast<int>(particles.size()) && c.b < static_cast<int>(particles.size())) constraints.push_back(c);
    }

    std::vector<StrainTriangle> strainTriangles;
    std::vector<IsometricBend> isometricBends;
    if (clothModel == "strain-triangle" || bendingModel == "isometric-xpbd") {
        for (const auto &piece : request.at("pieces")) {
            const auto particleIndices = piece.at("particleIndices").get<std::vector<int>>();
            const auto flatVertices = piece.at("flatVerticesM");
            const auto fabric = piece.value("fabric", json::object());
            const Real grainAngle = numberValue(piece, "grainAngleDeg", 0.0) * Real(M_PI / 180.0);
            const Real cosine = std::cos(grainAngle);
            const Real sine = std::sin(grainAngle);
            const Real warpStretch = std::max(Real(0.0), numberValue(fabric, "stretchWarp", 0.05));
            const Real weftStretch = std::max(Real(0.0), numberValue(fabric, "stretchWeft", 0.05));
            const Real shearMaterial = clampValue(numberValue(fabric, "shear", 0.72), Real(0.05), Real(0.98));
            const Real xx = clampValue(structuralStiffness * (1.0 - weftStretch * 0.55), Real(0.35), Real(0.995));
            const Real yy = clampValue(structuralStiffness * (1.0 - warpStretch * 0.55), Real(0.35), Real(0.995));
            const Real xy = clampValue(shearMaterial * structuralStiffness, Real(0.20), Real(0.92));

            std::vector<Vector3r> rest;
            rest.reserve(flatVertices.size());
            for (const auto &flat : flatVertices) {
                const Real x = flat.at(0).get<Real>();
                const Real y = flat.at(1).get<Real>();
                // x' follows weft, y' follows warp for the configured grain.
                rest.emplace_back(x * cosine - y * sine, x * sine + y * cosine, 0.0);
            }

            if (clothModel == "strain-triangle") for (const auto &face : piece.at("faces")) {
                const int la = face.at(0).get<int>();
                const int lb = face.at(1).get<int>();
                const int lc = face.at(2).get<int>();
                if (la < 0 || lb < 0 || lc < 0 || la >= static_cast<int>(particleIndices.size()) || lb >= static_cast<int>(particleIndices.size()) || lc >= static_cast<int>(particleIndices.size())) continue;
                StrainTriangle triangle;
                triangle.a = particleIndices[la];
                triangle.b = particleIndices[lb];
                triangle.c = particleIndices[lc];
                triangle.xxStiffness = xx;
                triangle.yyStiffness = yy;
                triangle.xyStiffness = xy;
                if (PBD::PositionBasedDynamics::init_StrainTriangleConstraint(rest[la], rest[lb], rest[lc], triangle.invRestMat)) {
                    strainTriangles.push_back(triangle);
                }
            }

            if (bendingModel == "isometric-xpbd") {
                std::map<std::pair<int, int>, std::vector<int>> edgeOpposites;
                for (const auto &face : piece.at("faces")) {
                    const int a = face.at(0).get<int>();
                    const int b = face.at(1).get<int>();
                    const int c = face.at(2).get<int>();
                    auto addEdge = [&edgeOpposites](int left, int right, int opposite) {
                        const auto key = std::minmax(left, right);
                        edgeOpposites[key].push_back(opposite);
                    };
                    addEdge(a, b, c);
                    addEdge(b, c, a);
                    addEdge(c, a, b);
                }
                const Real materialBend = clampValue(numberValue(fabric, "bend", 0.65), Real(0.0), Real(1.0));
                const Real bendingStiffness = Real(0.002) + materialBend * materialBend * Real(0.018);
                for (const auto &[edge, opposites] : edgeOpposites) {
                    if (opposites.size() != 2 || opposites[0] == opposites[1]) continue;
                    const int e0 = edge.first;
                    const int e1 = edge.second;
                    const int o0 = opposites[0];
                    const int o1 = opposites[1];
                    if (e0 < 0 || e1 < 0 || o0 < 0 || o1 < 0 ||
                        e0 >= static_cast<int>(particleIndices.size()) || e1 >= static_cast<int>(particleIndices.size()) ||
                        o0 >= static_cast<int>(particleIndices.size()) || o1 >= static_cast<int>(particleIndices.size())) continue;
                    IsometricBend bend;
                    bend.p0 = particleIndices[o0];
                    bend.p1 = particleIndices[o1];
                    bend.p2 = particleIndices[e0];
                    bend.p3 = particleIndices[e1];
                    bend.stiffness = bendingStiffness;
                    if (PBD::XPBD::init_IsometricBendingConstraint(rest[o0], rest[o1], rest[e0], rest[e1], bend.Q)) {
                        isometricBends.push_back(bend);
                    }
                }
            }
        }
    }

    std::vector<Anchor> anchors;
    for (const auto &item : request.value("anchors", json::array())) {
        Anchor a;
        a.particle = item.value("particle", -1);
        a.target = vec3(item.at("target"));
        a.stiffness = item.value("stiffness", 0.2);
        if (item.find("axes") != item.end() && item.at("axes").is_string()) {
            const std::string axes = item.at("axes").get<std::string>();
            if (axes == "x") { a.axisX = true; a.axisY = false; a.axisZ = false; }
            else if (axes == "xz") { a.axisX = true; a.axisY = false; a.axisZ = true; }
        } else if (item.find("axes") != item.end() && item.at("axes").is_array()) {
            a.axisX = a.axisY = a.axisZ = false;
            for (const auto &axis : item.at("axes")) {
                const auto name = axis.get<std::string>();
                if (name == "x") a.axisX = true;
                if (name == "y") a.axisY = true;
                if (name == "z") a.axisZ = true;
            }
        }
        if (a.particle >= 0 && a.particle < static_cast<int>(particles.size())) anchors.push_back(a);
    }

    std::unordered_set<std::uint64_t> collisionExclusions;
    for (const auto &pair : request.value("collisionExclusions", json::array())) {
        if (!pair.is_array() || pair.size() < 2) continue;
        const int a = pair.at(0).get<int>();
        const int b = pair.at(1).get<int>();
        if (a >= 0 && b >= 0 && a < static_cast<int>(particles.size()) && b < static_cast<int>(particles.size())) {
            collisionExclusions.insert(pairKey(a, b));
        }
    }
    std::set<std::string> fusedPiecePairs;
    for (const auto &entry : request.value("fusedPiecePairs", json::array())) {
        if (entry.is_string()) fusedPiecePairs.insert(entry.get<std::string>());
    }
    const Real selfCollisionDistance = std::max(Real(0.004), maxThickness * 2.0 + selfCollisionMargin);

    for (int frame = 0; frame < frames; ++frame) {
        const Real subDt = dt / substeps;
        const Real subDamping = std::pow(damping, Real(1.0) / substeps);
        for (int substep = 0; substep < substeps; ++substep) {
            for (auto &particle : particles) {
                if (particle.invMass <= 0.0) continue;
                Vector3r velocity = (particle.position - particle.previous) * subDamping;
                particle.previous = particle.position;
                particle.position += velocity;
                particle.position.y() -= gravity * subDt * subDt;
            }
            for (auto &constraint : constraints) constraint.lambda = 0.0;
            for (auto &bend : isometricBends) bend.lambda = 0.0;

            for (int iteration = 0; iteration < iterations; ++iteration) {
                const bool forward = ((iteration + substep) % 2 == 0);
                if (clothModel == "strain-triangle") {
                    const int triangleCount = static_cast<int>(strainTriangles.size());
                    for (int slot = 0; slot < triangleCount; ++slot) {
                        auto &triangle = strainTriangles[forward ? slot : triangleCount - 1 - slot];
                        auto &a = particles[triangle.a];
                        auto &b = particles[triangle.b];
                        auto &c = particles[triangle.c];
                        Vector3r corrA = Vector3r::Zero();
                        Vector3r corrB = Vector3r::Zero();
                        Vector3r corrC = Vector3r::Zero();
                        if (PBD::PositionBasedDynamics::solve_StrainTriangleConstraint(
                            a.position, a.invMass,
                            b.position, b.invMass,
                            c.position, c.invMass,
                            triangle.invRestMat,
                            triangle.xxStiffness,
                            triangle.yyStiffness,
                            triangle.xyStiffness,
                            true,
                            true,
                            corrA, corrB, corrC)) {
                            if (a.invMass > 0.0) a.position += corrA;
                            if (b.invMass > 0.0) b.position += corrB;
                            if (c.invMass > 0.0) c.position += corrC;
                        }
                    }
                }
                for (int slot = 0; slot < static_cast<int>(constraints.size()); ++slot) {
                    auto &constraint = constraints[forward ? slot : static_cast<int>(constraints.size()) - 1 - slot];
                    if (clothModel == "strain-triangle" && constraint.type == "structural") continue;
                    if (bendingModel == "isometric-xpbd" && constraint.type == "bend") continue;
                    auto &a = particles[constraint.a];
                    auto &b = particles[constraint.b];
                    Vector3r corrA = Vector3r::Zero();
                    Vector3r corrB = Vector3r::Zero();
                    PBD::XPBD::solve_DistanceConstraint(
                        a.position, a.invMass,
                        b.position, b.invMass,
                        constraint.rest, constraint.stiffness, subDt,
                        constraint.lambda, corrA, corrB);
                    if (a.invMass > 0.0) a.position += corrA;
                    if (b.invMass > 0.0) b.position += corrB;
                }
                if (bendingModel == "isometric-xpbd") {
                    const int bendCount = static_cast<int>(isometricBends.size());
                    for (int slot = 0; slot < bendCount; ++slot) {
                        auto &bend = isometricBends[forward ? slot : bendCount - 1 - slot];
                        auto &p0 = particles[bend.p0];
                        auto &p1 = particles[bend.p1];
                        auto &p2 = particles[bend.p2];
                        auto &p3 = particles[bend.p3];
                        Vector3r c0 = Vector3r::Zero();
                        Vector3r c1 = Vector3r::Zero();
                        Vector3r c2 = Vector3r::Zero();
                        Vector3r c3 = Vector3r::Zero();
                        if (PBD::XPBD::solve_IsometricBendingConstraint(
                            p0.position, p0.invMass,
                            p1.position, p1.invMass,
                            p2.position, p2.invMass,
                            p3.position, p3.invMass,
                            bend.Q, bend.stiffness, subDt, bend.lambda,
                            c0, c1, c2, c3)) {
                            if (p0.invMass > 0.0) p0.position += c0;
                            if (p1.invMass > 0.0) p1.position += c1;
                            if (p2.invMass > 0.0) p2.position += c2;
                            if (p3.invMass > 0.0) p3.position += c3;
                        }
                    }
                }
                for (const auto &anchor : anchors) {
                    auto &p = particles[anchor.particle];
                    if (p.invMass <= 0.0) continue;
                    Vector3r delta = anchor.target - p.position;
                    if (!anchor.axisX) delta.x() = 0.0;
                    if (!anchor.axisY) delta.y() = 0.0;
                    if (!anchor.axisZ) delta.z() = 0.0;
                    p.position += delta * anchor.stiffness;
                    if (anchor.axisX) p.previous.x() = p.position.x();
                    if (anchor.axisY) p.previous.y() = p.position.y();
                    if (anchor.axisZ) p.previous.z() = p.position.z();
                }
                if (selfCollision) resolveSelfCollisions(particles, selfCollisionDistance, collisionExclusions, fusedPiecePairs);
                if (collisions) {
                    for (auto &particle : particles) collideAvatar(particle, avatar, collisionMargin);
                    stabilizeSeamPairs(constraints, particles, avatar, collisionMargin);
                }
                stabilizeConstructionSides(particles);
            }
        }
    }

    Real totalError = 0.0;
    Real maxError = 0.0;
    Real seamTotal = 0.0;
    Real seamMax = 0.0;
    int seamCount = 0;
    for (const auto &constraint : constraints) {
        const Real distance = (particles[constraint.a].position - particles[constraint.b].position).norm();
        const Real error = std::abs(distance - constraint.rest);
        totalError += error;
        maxError = std::max(maxError, error);
        if (constraint.type == "seam") {
            seamTotal += distance;
            seamMax = std::max(seamMax, distance);
            ++seamCount;
        }
    }

    json pieces = json::array();
    for (const auto &piece : request.at("pieces")) {
        json outPiece;
        const std::string pieceId = stringValue(piece, "id");
        outPiece["id"] = pieceId;
        outPiece["name"] = stringValue(piece, "name", pieceId);
        outPiece["faces"] = piece.value("faces", json::array());
        outPiece["vertices"] = json::array();
        for (const auto &indexValue : piece.at("particleIndices")) {
            const int index = indexValue.get<int>();
            outPiece["vertices"].push_back(jsonVec(particles[index].position));
        }
        pieces.push_back(outPiece);
    }

    const bool finite = std::all_of(particles.begin(), particles.end(), [](const Particle &p) { return p.position.allFinite(); });
    json output;
    output["protocol"] = "garment-studio.native-xpbd-result";
    output["version"] = 1;
    output["backendId"] = "native-pbd-xpbd";
    output["frames"] = frames;
    output["pieces"] = pieces;
    output["state"] = json::object();
    output["state"]["particles"] = json::array();
    for (const auto &particle : particles) {
        output["state"]["particles"].push_back({
            {"id", particle.id},
            {"pieceId", particle.pieceId},
            {"position", jsonVec(particle.position)},
            {"previous", jsonVec(particle.previous)},
            {"contactDepth", particle.contactDepth}
        });
    }
    output["stats"] = {
        {"particles", particles.size()},
        {"constraints", constraints.size()},
        {"anchors", anchors.size()},
        {"averageConstraintError", constraints.empty() ? 0.0 : totalError / constraints.size()},
        {"maxConstraintError", maxError},
        {"seamAverageDistance", seamCount ? seamTotal / seamCount : 0.0},
        {"seamMaxDistance", seamMax},
        {"finite", finite}
    };
    output["stats"]["clothModel"] = clothModel;
    output["stats"]["strainTriangles"] = strainTriangles.size();
    output["stats"]["bendingModel"] = bendingModel;
    output["stats"]["isometricBends"] = isometricBends.size();

    std::ofstream out(outputPath);
    if (!out) throw std::runtime_error("Cannot open output: " + outputPath);
    out << std::setw(2) << output << '\n';
    json summary;
    summary["backendId"] = output["backendId"];
    summary["frames"] = output["frames"];
    summary["pieces"] = pieces.size();
    summary["stats"] = output["stats"];
    std::cout << summary.dump() << '\n';
    return finite ? 0 : 1;
}
